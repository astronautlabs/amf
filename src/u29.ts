import { BitstreamElement, BitstreamReader, BitstreamWriter, FieldDefinition, IncompleteReadResult, Serializer } from "@astronautlabs/bitstream";

export class U29Serializer implements Serializer {
    *read(reader: BitstreamReader, type: any, parent: BitstreamElement, field: FieldDefinition): Generator<IncompleteReadResult, any> {
        if (!reader.isAvailable(8))
            yield { remaining: 8 };
        
        let byte1 = reader.readSync(8);

        if ((byte1 & 0x80) !== 0) {
            if (!reader.isAvailable(8))
                yield { remaining: 8 };
            let byte2 = reader.readSync(8);
            if ((byte2 & 0x80) !== 0) {
                if (!reader.isAvailable(8))
                    yield { remaining: 8 };
                let byte3 = reader.readSync(8);
                if((byte3 & 0x80) !== 0) {
                    if (!reader.isAvailable(8))
                        yield { remaining: 8 };
                    let byte4 = reader.readSync(8);
                    
                    return ((byte1 & 0x7f) << 21) | ((byte2 & 0x7f) << 14) | ((byte3 & 0x7f) << 7) | byte4;
                } else {
                    return ((byte1 & 0x7f) << 14) | ((byte2 & 0x7f) << 7) | byte3;
                }
            } else {
                return ((byte1 & 0x7f) << 7) | byte2;
            }
        } else {
            return byte1;
        }
    }

    write(writer: BitstreamWriter, type: any, parent: BitstreamElement, field: FieldDefinition, value: any) {
        if (value >= 0x200000)
            writer.write(8, 0x80 | ((value & 0xFE00000) >> 21));

        if (value >= 0x4000) 
            writer.write(8, 0x80 | ((value & 0x1FC000) >> 14));

        if (value >= 0x80) 
            writer.write(8, 0x80 | ((value & 0x3f80) >> 7));

        writer.write(8, (value & 0x7f));
    }
}
