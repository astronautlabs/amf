import { BitstreamElement, BitstreamReader, BitstreamWriter, DefaultVariant, Field, FieldDefinition, Serializer, Variant } from "@astronautlabs/bitstream";
import { U29Serializer } from "./u29";


export enum TypeMarker {
    Undefined = 0x00,
    Null = 0x01,
    False = 0x02,
    True = 0x03,
    Integer = 0x04,
    Double = 0x05,
    String = 0x06,
    XmlDocument = 0x07,
    Date = 0x08,
    Array = 0x09,
    Object = 0x0A,
    Xml = 0x0B,
    ByteArray = 0x0C,
    VectorInt = 0x0D,
    VectorUint = 0x0E,
    VectorDouble = 0x0F,
    VectorObject = 0x10,
    Dictionary = 0x11
}

export function Type(type : Function) : PropertyDecorator {
    return (target, propertyKey) => {
        Reflect.defineMetadata('amf:type', type, target, propertyKey)
    };
}

export function amfTypeForProperty(object : any, propertyKey : string): Constructor<Value> {
    let value = object[propertyKey];

    let declared = Reflect.getMetadata('amf:type', object.prototype);

    if (declared)
        return declared;

    return amfTypeForValue(value);
}

export type Constructor<T> = { new() : T };

export function amfTypeForValue(value): Constructor<Value> {
    if (typeof value === 'number')
        return DoubleValue;
    if (typeof value === 'undefined')
        return UndefinedValue;
    if (value === null)
        return NullValue;
    if (value === true)
        return TrueValue;
    if (value === false)
        return FalseValue;
    if (typeof value === 'string')
        return StringValue;
    if (value instanceof Date)
        return DateValue;
    if (value instanceof Buffer)
        return ByteArray;
    if (value instanceof Uint32Array)
        return UIntVectorValue;
    if (value instanceof Int32Array)
        return IntVectorValue;
    if (value instanceof Map)
        return DictionaryValue;
    if (Array.isArray(value))
        return ArrayValue;
    if (typeof value === 'object')
        return ObjectValue;
}

/**
 * Represents an AMF3 "Value" in the binary protocol
 */
 export class Value<T = any> extends BitstreamElement {

    private objectTraits : Traits[] = [];

    @Field(8*1) marker : TypeMarker;

    get value() : T { return undefined; }
    set value(value) { throw new Error(`Value cannot be set on this type [${this.constructor.name}]`); }

    static get undefined() { return new UndefinedValue(); }
    static get null() { return new NullValue(); }
    static boolean(value : boolean) {
        if (value)
            return new TrueValue();
        else
            return new FalseValue();
    }
    static int(value : number) {
        return new IntegerValue().with({ value });
    }

    static double(value : number) {
        return new DoubleValue().with({ value });
    }

    static string(value : string) {
        return new StringValue().with({ value });
    }

    static xmlDocument(value : string) {
        return new XmlDocumentValue().with({ value });
    }

    static xml(value : string) {
        return new XmlValue().with({ value });
    }

    static date(value : Date) {
        return new DateValue().with({ value });
    }

    static any(value : any) : Value {
        return value instanceof Value ? value : new (amfTypeForValue(value))().with({ value });
    }

    static array(array : any[]) : ArrayValue {
        let keys = Object.keys(array);
        let keySet = new Set(keys);
        let associativeKeySet = new Set(keys);

        let isSparse = false;
        let maxDenseKey : number = undefined;

        // Determine how dense the array is and which keys are associative.
        // This will include any keys that are not part of the dense portion 
        // of the array

        for (let i = 0, max = array.length; i < max; ++i) {
            if (!keySet.has(i.toString())) {
                isSparse = true;
                continue;
            }
            
            if (!isSparse) {
                maxDenseKey = i;
                associativeKeySet.delete(i.toString());
            }
        }

        return new ArrayValue().with({
            values: 
                array.slice(0, maxDenseKey + 1)
                     .map(value => Value.any(value)),
            
            associativeValues: 
                Array.from(associativeKeySet.values())
                    .map(key => new AssociativeValue().with({
                        key, 
                        value: Value.any(array[key]) 
                    }))
        });
    }

    static object(object : object, keys? : string[]) {
        keys ??= Object.keys(object).filter(key => typeof object[key] === 'function');

        return new ObjectValueWithTraits().with({
            traits: new Traits().with({ 
                className: new StringOrReference().with({ value: '' }),
                sealedMemberNames: keys.map(x => new StringOrReference().with({ value: x }))
            }),
            values: keys.map(key => new (amfTypeForProperty(object, key))().with({ value: object[key] }))
        });
    }

    static byteArray(buffer : Uint8Array | Buffer) {
        return new ByteArray().with({
            value: Buffer.from(buffer)
        });
    }

    static vector(value : Int32Array | Uint32Array | number[]) {
        if (value instanceof Int32Array)
            return new IntVectorValue().with({ value });
        if (value instanceof Uint32Array)
            return new UIntVectorValue().with({ value });
        if (Array.isArray(value)) {
            if (value.some(x => typeof x !== 'number')) {
                throw new TypeError(
                    `Passing number[] to vector() produces a DoubleVector `
                    + `but the passed array has one or more elements which are `
                    + `not of type 'number'. Did you mean to use objectVector()?`
                );
            }

            return new DoubleVectorValue().with({ value });
        }

        throw new TypeError(`The passed value cannot be converted to an Int32, Uint32 or Double AMF3 vector!`);
    }

    static objectVector(values : any[]) {
        return new ObjectVectorValue().with({ values: values.map(x => Value.any(x)) });
    }

    static dictionary<K, V>(map : Map<K, V>): DictionaryValue<K, V> {
        return new DictionaryValue<K, V>().with({ value: map });
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Undefined)
export class UndefinedValue extends Value<undefined> {
    get value() { return undefined; }
}

@Variant<Value>(i => i.marker === TypeMarker.Null)
export class NullValue extends Value<null> {
    get value() { return null; }
}

@Variant<Value>(i => i.marker === TypeMarker.False)
export class FalseValue extends Value<false> {
    get value() { return <false>false; }
}

@Variant<Value>(i => i.marker === TypeMarker.True)
export class TrueValue extends Value<true> {
    get value() { return <true>true; }
}

@Variant<Value>(i => i.marker === TypeMarker.Integer)
export class IntegerValue extends Value<number> {
    @Field(0, { serializer: new U29Serializer() })
    $value : number;

    get value() { return this.$value; }
    set value(value) { this.$value = value; }
}

@Variant<Value>(i => i.marker === TypeMarker.Double)
export class DoubleValue extends Value<number> {
    @Field(8*8, { number: { format: 'float' } })
    $value : number;

    get value() { return this.$value; }
    set value(value) { this.$value = value; }
}

export class StringOrReference extends BitstreamElement {
    @Field(0, { serializer: new U29Serializer() }) 
    private $lengthOrReference : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$lengthOrReference & 0x1) === 1;
    }

    @Field((i : StringOrReference) => i.$lengthOrReference >> 1, { presentWhen: (i : StringOrReference) => !i.isReference })
    private $value : string;

    get id() { return this.isReference ? this.$lengthOrReference >> 1 : undefined };
    set id(value) {
        if (value > 0xFFFFFFF)
            throw new Error(`Maximum ID is 0xFFFFFFF (1114111)`);
        
        this.$lengthOrReference = (value << 1);
        this.$value = undefined;
    }

    get value() {  return this.$value; }
    set value(value) {
        this.$lengthOrReference = (Buffer.from(value).length << 1) | 0x1;
        this.$value = value; 
    }
}

/**
 * Represents the "String" type of "Value" in Adobe's ActionScript Message Format (AMF) version 3.
 * - U29Serializer: Encodes/decodes values in AMF3's custom variable-length integer format
 * - Low bit of 0 or 1 on the "length" field determines if the value is a reference to a String Table entry
 *   or is an inline string literal 
 * - Thus IDs and lengths are limited to 2^28 since variable length strs are max 29 bits
 * 
 * From the user's perspective, just set either `id` or `value`. When reading use `isReference()` to determine 
 * whether this string is a reference to the string table or literal and `id` or `value` respectively. `id` and 
 * `value` return `undefined` when they are not relevant for this object.
 */
@Variant<Value>(i => [TypeMarker.String, TypeMarker.XmlDocument, TypeMarker.Xml].includes(i.marker))
export class StringValue extends Value<string> {
    @Field() stringOrReference : StringOrReference = new StringOrReference();

    get isLiteral() { return this.stringOrReference.isLiteral; }
    get isReference() { return this.stringOrReference.isReference; }
    get id() { return this.stringOrReference.id; }
    set id(id) { this.stringOrReference.id = id; };
    get value() { return this.stringOrReference.value; }
    set value(value) { this.stringOrReference.value = value; }
}

@Variant<StringValue>(i => i.marker === TypeMarker.XmlDocument)
export class XmlDocumentValue extends StringValue { }

@Variant<StringValue>(i => i.marker === TypeMarker.Xml)
export class XmlValue extends StringValue { }

@Variant<Value>(i => i.marker === TypeMarker.Date)
export class DateValue extends Value<Date> {
    @Field(0, { serializer: new U29Serializer() }) 
    isLiteral : boolean;
    get isReference() { return !this.isLiteral; }

    @Field(8*8, { number: { format: 'float' }, presentWhen: i => i.isLiteral })
    private $value : number = 0;

    private $date : Date;

    get value() {
        return this.$date ??= new Date(this.$value);
    }

    set value(value) {
        if (value === null || value === void 0)
            throw new TypeError(`AMF3 cannot transport null/undefined Date`);

        if (!(value instanceof Date))
            throw new TypeError(`Value must be a valid Date`);

        this.$date = value;
        this.$value = value.getTime();
    }
}

export class AssociativeValueSerializer implements Serializer {
    *read(reader: BitstreamReader, type: any, parent: BitstreamElement, field: FieldDefinition) {
        let assocs : AssociativeValue[] = [];

        while (true) {
            let av = AssociativeValue.read(reader).next();
            if (av.done === false) {
                yield av.value;
                return;
            }
            
            if (av.value.key === '')
                break;
            
            assocs.push(av.value);
        }

        return assocs;
    }

    write(writer: BitstreamWriter, type: any, parent: BitstreamElement, field: FieldDefinition, value: AssociativeValue[]) {
        value.forEach(a => a.write(writer));
        new AssociativeValue().with({ key: '' }).write(writer);
    }
}

@Variant<Value>(i => i.marker === TypeMarker.Array)
export class ArrayValue extends Value<Date> {
    @Field(0, { serializer: new U29Serializer(), writtenValue: (i : ArrayValue) => i.isLiteral ? ((i.values.length << 1) | 0x1) : (i.id << 1) })
    private $denseLengthOrReference : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$denseLengthOrReference & 0x1) === 1;
    }

    get id() { return this.isReference ? this.$denseLengthOrReference >> 1 : undefined };
    set id(value) {
        if (value > 0xFFFFFFF)
            throw new Error(`Maximum ID is 0xFFFFFFF (1114111)`);
        
        this.$denseLengthOrReference = (value << 1);
        this.values = undefined;
    }

    get denseLength() {
        if (this.isLiteral)
            return this.values?.length ?? this.$denseLengthOrReference >> 1;
    }

    @Field(0, { serializer: new AssociativeValueSerializer() })
    associativeValues : AssociativeValue[] = [];

    @Field(i => i.denseLength, { array: { type: Value }})
    values : Value[];
}

export class AssociativeValue extends BitstreamElement {
    @Field() private $key : StringOrReference;

    get key() { return this.$key.value; }
    set key(value) { this.$key.value = value; }

    @Field(0, { presentWhen: i => i.key !== '' }) value : Value;
}

@Variant<Value>(i => i.marker === TypeMarker.Object)
export class ObjectValue extends Value<object> {
    @Field(0, { serializer: new U29Serializer() }) $objectTypeIndicator : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$objectTypeIndicator & 0x1) === 1;
    }

    get isTraitLiteral() {
        return this.isLiteral && (this.$objectTypeIndicator & 0x2) === 2;
    }

    get isTraitReference() {
        return !this.isTraitLiteral;
    }

    get isExternalizable() {
        return this.isTraitLiteral && (this.$objectTypeIndicator & 0x4) === 0x4;
    }

    get id() {
        return this.isReference ? this.$objectTypeIndicator >> 1 : undefined;
    }

    set id(value) {
        this.$objectTypeIndicator = value << 1;
    }

    static reference(id : number) {
        return new ObjectValue().with({ id });
    }
}

export class Traits extends BitstreamElement {
    @Field() className : StringOrReference;
    @Field((i : ObjectValueWithTraits) => i.sealedMemberNameCount, { array: { type: String } }) 
    sealedMemberNames : StringOrReference[] = [];

    get isDynamic() {
        if (!(this.parent instanceof ObjectValueWithTraits))
            throw new TypeError(`Traits class can only be used as part of ObjectValueWithTraits`);
        return (this.parent as ObjectValueWithTraits).isDynamic;
    }
}

@Variant<ObjectValue>(i => !i.isExternalizable)
export class ObjectValueWithTraits extends ObjectValue {
    get isDynamic() { return (this.$objectTypeIndicator & 0x8) === 0x8; }
    set isDynamic(value) { 
        if (value)
            this.$objectTypeIndicator |= 0x8; 
        else
            this.$objectTypeIndicator &= ~0x8;
    }

    get sealedMemberNameCount() {
        return this.$objectTypeIndicator & 0x1ffffff0;
    }

    @Field() traits : Traits;
    
    @Field(0, { presentWhen: i => i.isDynamic, serializer: new AssociativeValueSerializer() }) 
    dynamicMembers : AssociativeValue[] = [];

    @Field()
    values : Value[] = [];
}

@Variant<ObjectValue>(i => i.isExternalizable)
export class ObjectValueWithExternalizableTraits extends ObjectValue {
    @Field() className : StringOrReference;
}

@DefaultVariant()
export class ObjectValueWithUnknownExternalizableTraits extends ObjectValueWithExternalizableTraits {
    constructor() {
        super();
        throw new TypeError(`Unsupported externalizable object value`);
    }
}

@Variant<ObjectValue>(i => !i.isExternalizable)
export class TraitObjectValue extends ObjectValue {
}


@Variant<Value>(i => i.marker === TypeMarker.Integer)
export class ByteArray extends Value<Buffer> {
    @Field(0, { serializer: new U29Serializer(), writtenValue: i => i.value.length })
    private $lengthOrReference : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$lengthOrReference & 0x1) === 1;
    }

    get id() {
        return this.isReference ? this.$lengthOrReference >> 1 : undefined;
    }

    set id(value) {
        this.$lengthOrReference = value << 1;
    }

    @Field(i => i.$length)
    $value : Buffer;

    get value() { return this.isLiteral ? this.$value : undefined; }
    set value(value) { this.$value = value; this.$lengthOrReference = value.length << 1 | 0x1 };
}

@Variant<Value>(i => [TypeMarker.VectorDouble, TypeMarker.VectorInt, TypeMarker.VectorObject, TypeMarker.VectorUint].includes(i.marker))
export class VectorValue<T = any> extends Value<T> {
    @Field(0, { serializer: new U29Serializer(), writtenValue: i => i.value.length })
    private $lengthOrReference : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$lengthOrReference & 0x1) === 1;
    }

    get id() {
        return this.isReference ? this.$lengthOrReference >> 1 : undefined;
    }

    set id(value) {
        this.$lengthOrReference = value << 1;
    }

    get length() {
        return this.isLiteral ? this.$lengthOrReference >> 1 : undefined;
    }

    @Field(8, { presentWhen: i => i.isLiteral })
    isFixed : boolean = true;

    @Field() 
    objectTypeName : StringOrReference;
}

@Variant<VectorValue>(i => i.marker === TypeMarker.VectorObject)
export class ObjectVectorValue extends VectorValue<object> {
    @Field(i => i.length, { array: { type: Value }})
    values : Value[];

    get value() { return this.values; }
    set value(value) { this.values = value; }
}

@Variant<VectorValue>(i => i.marker === TypeMarker.VectorDouble)
export class DoubleVectorValue extends VectorValue<number[]> {
    @Field(i => i.length, { array: { type: Number, elementLength: 8*2 }, number: { format: 'float' } })
    values : number[];

    get value() { return this.values; }
    set value(value) { this.values = value; }
}

@Variant<VectorValue>(i => [TypeMarker.VectorInt, TypeMarker.VectorUint].includes(i.marker))
export class IntVectorValue extends VectorValue<Int32Array> {
    @Field(i => i.length)
    $value : Uint8Array;

    get value() { return new Int32Array(this.$value); }
    set value(value) { this.$value = new Uint8Array(value); }
}

@Variant<VectorValue>(i => i.marker === TypeMarker.VectorUint)
export class UIntVectorValue extends VectorValue<Uint32Array> {
    @Field(i => i.length)
    $value : Uint8Array;

    get value() { return new Uint32Array(this.$value); }
    set value(value) { this.$value = new Uint8Array(value); }
}

export class DictionaryEntry extends BitstreamElement {
    @Field() key : Value;
    @Field() value : Value;
}

@Variant<Value>(i => i.marker === TypeMarker.Dictionary)
export class DictionaryValue<K = any, V = any> extends Value<Map<K,V>> {
    @Field(0, { serializer: new U29Serializer(), writtenValue: i => i.value.length })
    private $lengthOrReference : number;

    get isReference() {
        return !this.isLiteral;
    }

    get isLiteral() {
        return (this.$lengthOrReference & 0x1) === 1;
    }

    get id() {
        return this.isReference ? this.$lengthOrReference >> 1 : undefined;
    }

    set id(value) {
        this.$lengthOrReference = value << 1;
    }

    get length() {
        return this.isLiteral ? this.$lengthOrReference >> 1 : undefined;
    }

    @Field(8, { presentWhen: i => i.isLiteral }) 
    hasWeakKeys : boolean;

    get value() {
        return new Map<K, V>(this.entries.map(e => [e.key.value, e.value.value]));
    }

    set value(value) {
        let entries : DictionaryEntry[] = [];
        value.forEach((v, k) => {
            entries.push(new DictionaryEntry().with({ key: Value.any(k), value: Value.any(v) }));
        });
        this.entries = entries;
    }

    @Field(i => i.length, { presentWhen: i => i.isLiteral, array: { type: DictionaryEntry } })
    private $entries : DictionaryEntry[];

    get entries() { return this.$entries; }
    set entries(value) { this.$entries = value; this.$lengthOrReference = this.$entries.length << 1 | 0x1; }
}
