import { BitstreamElement, BitstreamReader, BitstreamWriter, FieldDefinition, IncompleteReadResult, resolveLength, Serializer } from "@astronautlabs/bitstream";

export class FloatSerializer implements Serializer {
    *read(reader: BitstreamReader, type: any, parent: BitstreamElement, field: FieldDefinition): Generator<IncompleteReadResult, any> {
        let length : number;
        try {
            length = resolveLength(field.length, parent, field);
        } catch (e) {
            throw new Error(`Failed to resolve length of number via 'length' determinant: ${e.message}`);
        }
        
        if (!reader.isAvailable(length))
            yield { remaining: length };
        
        if (length === 8) {
            return Buffer.from([ reader.readSync(8) ]).readFloatBE();
        } else if (length === 16) {
            return Buffer.from([ reader.readSync(8), reader.readSync(8) ]).readDoubleBE();
        } else {
            throw new Error(`FloatSerializer supports only 1-byte (8 bit) or 2-byte (16 bit) values`);
        }
    }

    write(writer: BitstreamWriter, type: any, parent: BitstreamElement, field: FieldDefinition, value: any) {
        let length : number;
        try {
            length = resolveLength(field.length, parent, field);
        } catch (e) {
            throw new Error(`Failed to resolve length of number via 'length' determinant: ${e.message}`);
        }

        if (length === 8) {
            let buf = Buffer.alloc(1);
            buf.writeFloatBE(value);
            writer.write(8, buf[0]);
        } else if (length === 16) {
            let buf = Buffer.alloc(2);
            buf.writeDoubleBE(value);
            writer.write(8, buf[0]);
            writer.write(8, buf[1]);
        } else {
            throw new Error(`FloatSerializer supports only 1-byte (8 bit) or 2-byte (16 bit) values`);
        }
    }
}
