import { BitstreamElement, Field, Variant, Serializer, BitstreamReader, BitstreamWriter, FieldDefinition, resolveLength, BufferedWritable, BooleanSerializer, Reserved, SerializeOptions, ReservedLow, BitstreamMeasurer, VariantMarker, IncompleteReadResult } from "@astronautlabs/bitstream";
import * as AMF3 from './amf3';

export enum TypeMarker {
    Number = 0x00,
    Boolean = 0x01,
    String = 0x02,
    Object = 0x03,
    MovieClip = 0x04,
    Null = 0x05,
    Undefined = 0x06,
    Reference = 0x07, // x
    EcmaArray = 0x08,
    ObjectEnd = 0x09,
    StrictArray = 0x0A,
    Date = 0x0B,
    LongString = 0x0C,
    Unsupported = 0x0D,
    RecordSet = 0x0E,
    XmlDocument = 0x0F,
    TypedObject = 0x10, // x
    AvmPlus = 0x11      // x
}


export class Value<T = any> extends BitstreamElement {

    private _referenceTable : ComplexValue[];

    get referenceTable() {
        if (!this._referenceTable) {
            if (this.context) {
                if (this.context.__references) { 
                    this._referenceTable = this.context.__references;
                } else {
                    this.context.__references = this._referenceTable = [];
                }
            }
        }

        return this._referenceTable;
    }

    @Field(8*1) marker : TypeMarker;

    get value(): T { return undefined; }
    set value(value) { 
        throw new Error(`Cannot set value [${this.constructor.name}]`);
    }

    static get undefined() {
        return new UndefinedValue();
    }

    static get true() {
        return this.boolean(true);
    }

    static get false() {
        return this.boolean(false);
    }

    static boolean(value : boolean) {
        return new BooleanValue().with({ value });
    }

    static number(value : number) {
        return new NumberValue().with({ value });
    }

    static string(value : string) {
        if (value.length > 0xFFFF)
            return new LongStringValue().with({ value });
        else
            return new StringValue().with({ value });
    }

    static xmlDocument(value : string) {
        return new XmlDocumentValue().with({ value });
    }

    static object(value : object, className? : string) {
        if (value === null || value === void 0 || typeof value !== 'object')
            throw new Error(`Invalid value for object: ${value}`);

        if (className)
            return new TypedObjectValue().with({ value, className });
        else
            return new ObjectValue().with({ value });
    }

    static get null() {
        return new NullValue();
    }

    static date(value : Date) {
        return new DateValue().with({ value });
    }

    static array(value : any[]) {
        return new StrictArrayValue().with({ value });
    }

    static associativeArray(value : Map<string, any> | Record<string,any>) {
        if (value instanceof Map)
            return new EcmaArrayValue().with({ value });
        else
            return new EcmaArrayValue().with({ value: new Map(Object.keys(value).map(key => [key, value[key]])) });
    }

    static any(value : any) {
        if (value instanceof Value)
            return value;
        if (value === void 0)
            return this.undefined;
        if (value === true)
            return this.true;
        if (value === false)
            return this.false;
        if (value === null)
            return this.null;
        if (typeof value === 'number')
            return this.number(value);
        if (typeof value === 'string')
            return this.string(value);
        if (value instanceof Date)
            return this.date(value);
        if (value instanceof Map)
            return this.associativeArray(value);
        if (Array.isArray(value))
            return this.array(value);
        if (typeof value === 'object')
            return this.object(value);
    }

    static avmPlus(value) {
        return new AvmPlusValue().with({ value });
    }

    static amf3(value) {
        return this.avmPlus(value);
    }
}
export class ObjectProperty extends BitstreamElement {
    @Field(8*2, { writtenValue: (i : ObjectProperty) => Buffer.from(i.key).length }) keyLength : number;

    private _key : string;

    @Field((i : ObjectProperty) => i.keyLength, { string: { encoding: 'utf-8' }}) 
    get key(): string { return this._key; }
    set key(value) { 
        if (typeof value !== 'string')
            throw new Error(`Key must be a string`);
        this._key = value; 
        this.keyLength = value.length; 
    }

    @Field() value : Value;
}

export class ObjectPropertyArraySerializer implements Serializer {
    *read(reader: BitstreamReader, type: any, parent: BitstreamElement, field: FieldDefinition): Generator<IncompleteReadResult, any> {
        let properties : ObjectProperty[] = [];

        let readOperation : Generator<IncompleteReadResult, ObjectProperty>;
        let hasMore = true;

        while (hasMore) {
            readOperation = ObjectProperty.read(reader);
            
            while (true) {
                let propResult = readOperation.next();
                if (propResult.done === false) {
                    yield propResult.value;
                } else {
                    let prop = propResult.value;
                    if (prop.value instanceof ObjectEndValue)
                        hasMore = false;
                    else
                        properties.push(prop);
                    break;
                }
            }
        }

        return properties;
    }

    write(writer: BitstreamWriter, type: any, parent: BitstreamElement, field: FieldDefinition, value: ObjectProperty[]) {
        for (let prop of value)
            prop.write(writer);

        new ObjectProperty()
            .with({ key: "", value: new ObjectEndValue() })
            .write(writer)
        ;
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Number)
export class NumberValue extends Value {
    marker = TypeMarker.Number;
    @Field(8*8, { number: { format: 'float' }}) private $value : number;
    get value() { return this.$value; }
    set value(value) { this.$value = value; }
}

@Variant<Value>(i => i.marker === TypeMarker.Boolean)
export class BooleanValue extends Value {
    marker = TypeMarker.Boolean;
    @Field(8*1) private $value : boolean;

    get value() { return this.$value; }
    set value(value) { this.$value = value; }
}

@Variant<Value>(i => i.marker === TypeMarker.String)
export class StringValue extends Value {
    marker = TypeMarker.String;
    @Field(8*2, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) length : number = 0;
    @Field((i : StringValue) => i.length, { string: { encoding: 'utf-8' }}) private $value : string;

    get value() { return this.$value; }
    set value(value) {
        if (typeof value !== 'string')
            throw new Error(`Value must be a string`);
        
        this.$value = value; 
        this.length = value.length;
    }
}

@Variant<Value>(i => [TypeMarker.Object, TypeMarker.TypedObject, TypeMarker.StrictArray, TypeMarker.EcmaArray].includes(i.marker))
export class ComplexValue<T = any> extends Value<T> {
    write(bitstream: BitstreamWriter, options?: SerializeOptions): void {
        this.context = options?.context ?? {};

        let json = JSON.stringify(this);
        if (!this.context.id)
            this.context.id = Math.floor(Math.random() * 1000);
        let index = this.referenceTable?.findIndex?.(x => JSON.stringify(x) === json);

        if (index >= 0) {
            new ReferenceValue().with({ index }).write(bitstream, options);
        } else {
            super.write(bitstream, options);
        }
    }

    onSerializeFinished(): void {
        this.referenceTable.push(this);
    }

    onParseFinished(): void {
        this.referenceTable.push(this);
    }
}

function symbol(): symbol {
    return Symbol('');
}
@Variant<Value>(i => [TypeMarker.Object, TypeMarker.TypedObject].includes(i.marker))
export class ObjectValue extends ComplexValue {
    marker = TypeMarker.Object;
    private _properties : ObjectProperty[];

    @VariantMarker() $objectVariantMarker;

    @Field(0, { 
        array: { type: ObjectProperty }, 
        serializer: new ObjectPropertyArraySerializer() 
    })
    get properties() : ObjectProperty[] {
        return this._properties;
    }

    set properties(value) {
        this._properties = value;
        this.buildValue();
    }

    private buildValue() {
        this._value = this.properties.reduce((o, p) => (o[p.key] = p.value.value, o), {});
    }

    private _value : any;

    get value() {
        return this._value;
    }

    set value(value) {
        this._value = value;
        this._properties = Object
            .keys(value ?? {})
            .map(key => new ObjectProperty().with({ 
                key,
                value: Value.any(value[key])
            }));
    }
}

@Variant<ObjectValue>(i => i.marker === TypeMarker.TypedObject)
export class TypedObjectValue extends ObjectValue {
    marker = TypeMarker.TypedObject;
    
    private _className : string;

    @Field(8*2, { writtenValue: (i : TypedObjectValue) => Buffer.from(i.className).length }) classNameLength : number;
    @Field((i : TypedObjectValue) => i.classNameLength, { string: { encoding: 'utf-8' }}) 
    get className() : string { 
        return this._className; 
    }

    set className(value) {
        if (typeof value !== 'string')
            throw new TypeError(`Class name must be a string`);

        this._className = value;
        this.classNameLength = value.length;
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Null)
export class NullValue extends Value<null> {
    marker = TypeMarker.Null;
}

@Variant<Value>(i => i.marker === TypeMarker.Undefined)
export class UndefinedValue extends Value<undefined> {
    marker = TypeMarker.Undefined;
}

@Variant<Value>(i => i.marker === TypeMarker.Reference)
export class ReferenceValue extends Value {
    marker = TypeMarker.Reference;
    @Field(8*2) index : number;

    get reference() {
        return this.referenceTable?.[this.index];
    }

    get value() {
        return this.reference?.value;
    }
}

@Variant<Value>(i => i.marker === TypeMarker.EcmaArray)
export class EcmaArrayValue<V = any> extends ComplexValue<Map<string, V>> {
    marker = TypeMarker.EcmaArray;

    @Field(8*4, { writtenValue: (i : EcmaArrayValue) => i._properties.length }) 
    private _count : number;

    private _properties : ObjectProperty[];

    @Field((i : EcmaArrayValue) => i._count, { array: { type: ObjectProperty }}) 
    private get properties() : ObjectProperty[] {
        return this._properties;
    }

    
    @Field((i : ObjectProperty) => 0, { string: { encoding: 'utf-8' }, writtenValue: '' })
    private endKey = '';

    @Field(8, { writtenValue: TypeMarker.ObjectEnd })
    private endMarker = TypeMarker.ObjectEnd;

    private set properties(value) {
        this._properties = value;
        this._value = new Map(value.map(prop => [prop.key, prop.value.value]));
    }

    private _value : Map<string, V>;
    get value() {
        return this._value;
    }

    set value(value) {
        this._value = value;
        this._properties = Array.from(value.entries()).map(([key, value]) => new ObjectProperty().with({ key, value: Value.any(value) }));
        this._count = this._properties.length;
    }
}

@Variant<Value>(i => i.marker === TypeMarker.ObjectEnd)
export class ObjectEndValue extends Value {
    marker = TypeMarker.ObjectEnd;
}

@Variant<Value>(i => i.marker === TypeMarker.StrictArray)
export class StrictArrayValue<T = any> extends ComplexValue<T[]> {
    marker = TypeMarker.StrictArray;

    private _value : T[];
    private _values : Value[];

    @Field(8*4) count : number;
    @Field((i : StrictArrayValue) => i.count, { array: { type: Value }}) 
    private get values() : Value[] {
        return this._values;
    }

    private set values(value) {
        this._values = value;
        this._value = value.map(z => z.value);
    }

    get value() {
        return this._value;
    }

    static elementValues(value : StrictArrayValue) {
        return value.values;
    }
    
    set value(value) {
        if (!Array.isArray(value))
            throw new Error(`Value must be an array`);
        this._value = value;
        this.values = value.map(z => Value.any(z));
        this.count = value.length;
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Date)
export class DateValue extends Value<Date> {
    marker = TypeMarker.Date;

    private _value : number;

    @Field(8*8, { number: { format: 'float' } }) 
    private get $value() : number {
        return this._value;
    }

    private set $value(value) {
        this._value = Math.floor(value);
    }

    @ReservedLow(8*2, { writtenValue: 0x0000 }) private timeZone : number;

    get value() {
        return new Date(this.$value);
    }

    set value(value) {
        this.$value = value.getTime();
    }
}

@Variant<Value>(i => i.marker === TypeMarker.LongString)
export class LongStringValue extends Value {
    marker = TypeMarker.LongString;
    @Field(8*4, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) 
    private _length : number;

    @Field((i : LongStringValue) => i._length, { string: { encoding: 'utf-8' }}) private $value : string;

    get value() { return this.$value; }
    set value(value) { 
        if (typeof value !== 'string')
            throw new TypeError(`Value must be a string`);
        this.$value = value; 
        this._length = value.length; 
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Unsupported)
export class UnsupportedValue extends Value {
    marker = TypeMarker.Unsupported;
}

@Variant<Value>(i => i.marker === TypeMarker.RecordSet)
export class RecordSetValue extends Value {
    marker = TypeMarker.RecordSet;
}

@Variant<Value>(i => i.marker === TypeMarker.MovieClip)
export class MovieClipValue extends Value {
    marker = TypeMarker.MovieClip;
}

@Variant<Value>(i => i.marker === TypeMarker.XmlDocument)
export class XmlDocumentValue extends Value {
    marker = TypeMarker.XmlDocument;

    @Field(8*4, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) 
    private _length : number;

    @Field((i : XmlDocumentValue) => i._length, { string: { encoding: 'utf-8' }}) private $value : string;

    get value() { return this.$value; }
    set value(value) { 
        if (typeof value !== 'string')
            throw new TypeError(`Value must be a string`);
        this.$value = value; 
        this._length = value.length; 
    }
}

@Variant<Value>(i => i.marker === TypeMarker.AvmPlus)
export class AvmPlusValue extends Value {
    marker = TypeMarker.AvmPlus;

    @Field()
    private $value : AMF3.Value;

    get value() {
        return this.$value?.value;
    }

    set value(value) {
        this.$value = AMF3.Value.any(value);
    }

    static unwrap(v : AvmPlusValue) {
        return v.$value;
    }
}