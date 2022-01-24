import { BitstreamElement, Field, Variant, Serializer, BitstreamReader, BitstreamWriter, FieldDefinition, resolveLength, BufferedWritable, BooleanSerializer, Reserved } from "@astronautlabs/bitstream";

export enum TypeMarker {
    Number = 0x00,
    Boolean = 0x01,
    String = 0x02,
    Object = 0x03,
    MovieClip = 0x04,
    Null = 0x05,
    Undefined = 0x06,
    Reference = 0x07,
    EcmaArray = 0x08,
    ObjectEnd = 0x09,
    StrictArray = 0x0A,
    Date = 0x0B,
    LongString = 0x0C,
    Unsupported = 0x0D,
    RecordSet = 0x0E,
    XmlDocument = 0x0F,
    TypedObject = 0x10,
    AvmPlus = 0x11
}

export class ObjectPropertyArraySerializer implements Serializer {
    *read(reader: BitstreamReader, type: any, parent: BitstreamElement, field: FieldDefinition) {
        let properties : ObjectProperty[] = [];

        while (true) {
            let propResult = ObjectProperty.read(reader).next();
            if (propResult.done === false) {
                yield propResult.value;
            } else {
                let prop = propResult.value;
                if (prop.value instanceof ObjectEndValue)
                    break;
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

export class Value extends BitstreamElement {
    @Field(8*1) marker : TypeMarker;
}

@Variant<Value>(i => i.marker === TypeMarker.Number)
export class NumberValue extends Value {
    @Field(8*8, { number: { format: 'float' }}) value : number;
}

@Variant<Value>(i => i.marker === TypeMarker.Boolean)
export class BooleanValue extends Value {
    @Field(8*1) value : boolean;
}

@Variant<Value>(i => i.marker === TypeMarker.String)
export class StringValue extends Value {
    @Field(8*2, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) length : number;
    @Field((i : StringValue) => i.length, { string: { encoding: 'utf-8' }}) value : string;
}

@Variant<Value>(i => i.marker === TypeMarker.Object)
export class ObjectValue extends Value {
    @Field(0, { serializer: new ObjectPropertyArraySerializer() }) properties : ObjectProperty[];
}

export class ObjectProperty extends BitstreamElement {
    @Field(8*2, { writtenValue: (i : ObjectProperty) => Buffer.from(i.key).length }) keyLength : number;
    @Field((i : ObjectProperty) => i.keyLength, { string: { encoding: 'utf-8' }}) key : string;
    @Field() value : Value;
}

@Variant<Value>(i => i.marker === TypeMarker.Null)
export class NullValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.Undefined)
export class UndefinedValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.Reference)
export class ReferenceValue extends Value {
    @Field(8*2) index : number;
}

@Variant<Value>(i => i.marker === TypeMarker.EcmaArray)
export class EcmaArrayValue extends Value {
    @Field(8*4, { writtenValue: (i : EcmaArrayValue) => i.properties.length }) count : number;
    @Field((i : EcmaArrayValue) => i.count, { array: { type: ObjectProperty }}) properties : ObjectProperty[];
}

@Variant<Value>(i => i.marker === TypeMarker.ObjectEnd)
export class ObjectEndValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.StrictArray)
export class StrictArrayValue extends Value {
    count : number;
    @Field((i : StrictArrayValue) => i.count, { array: { type: Value }}) 
    values : Value[];
}

@Variant<Value>(i => i.marker === TypeMarker.Date)
export class DateValue extends Value {
    @Field(8*8, { number: { format: 'float' } }) value : number;
    @Reserved(8*2, { writtenValue: 0x0000 }) timeZone : number;
}

@Variant<Value>(i => i.marker === TypeMarker.LongString)
export class LongStringValue extends Value {
    @Field(8*4, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) length : number;
    @Field(i => i.length, { string: { encoding: 'utf-8' }}) value : string;
}

@Variant<Value>(i => i.marker === TypeMarker.Unsupported)
export class UnsupportedValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.RecordSet)
export class RecordSetValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.MovieClip)
export class MovieClipValue extends Value {
}

@Variant<Value>(i => i.marker === TypeMarker.XmlDocument)
export class XmlDocumentValue extends Value {
    @Field(8*4, { writtenValue: (i : StringValue) => Buffer.from(i.value).length }) length : number;
    @Field(i => i.length, { string: { encoding: 'utf-8' }}) value : string;
}

@Variant<Value>(i => i.marker === TypeMarker.TypedObject)
export class TypedObjectValue extends Value {
    @Field(8*2, { writtenValue: (i : TypedObjectValue) => Buffer.from(i.className).length }) classNameLength : number;
    @Field((i : TypedObjectValue) => i.classNameLength, { string: { encoding: 'utf-8' }}) className : string;
    @Field(0, { serializer: new ObjectPropertyArraySerializer() }) properties : ObjectProperty[];
}
