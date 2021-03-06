import { describe } from 'razmin';
import { expect } from 'chai';
import { U29Serializer } from './u29';
import { BitstreamReader, BitstreamWriter, BufferedWritable } from '@astronautlabs/bitstream';

describe('U29Serializer', it => {
    function encode(number : number) {
        let serializer = new U29Serializer();
        let writable = new BufferedWritable();
        let writer = new BitstreamWriter(writable);
        serializer.write(writer, undefined, undefined, undefined, number);
        return Array.from(writable.buffer);
    }

    function decode(bytes : number[]) {
        let serializer = new U29Serializer();
        let reader = new BitstreamReader();

        reader.addBuffer(Uint8Array.from(bytes));
        let result = serializer.read(reader, undefined, undefined, undefined).next();
        
        expect(
            result.done, 
            `Decoding [${bytes.map(x => `0b${x.toString(2)}`)}]`
            + ` should be successful without requiring additional data to be read`
        )
        .to.be.true;

        return result.value;
    }

    const examples = [
        [0b0000001, [ 0b00000001 ]],
        [0b0000011, [ 0b00000011 ]],
        [0b0000111, [ 0b00000111 ]],
        [0b0001111, [ 0b00001111 ]],
        [0b0011111, [ 0b00011111 ]],
        [0b0111111, [ 0b00111111 ]],
        [0b1111111, [ 0b01111111 ]],

        [0b1010101, [ 0b01010101 ]],
        [0b1110111, [ 0b01110111 ]],
        [0b1000000, [ 0b01000000 ]],
        [0b1000001, [ 0b01000001 ]],
        [0b1001001, [ 0b01001001 ]],

        [0b0000001_1111111, [ 0b10000001, 0b01111111 ]],
        [0b0000011_1111111, [ 0b10000011, 0b01111111 ]],
        [0b0000111_1111111, [ 0b10000111, 0b01111111 ]],
        [0b0001111_1111111, [ 0b10001111, 0b01111111 ]],
        [0b0011111_1111111, [ 0b10011111, 0b01111111 ]],
        [0b0111111_1111111, [ 0b10111111, 0b01111111 ]],
        [0b1111111_1111111, [ 0b11111111, 0b01111111 ]],

        [0b0000001_1111111, [ 0b10000001, 0b01111111 ]],
        [0b0000010_1111111, [ 0b10000010, 0b01111111 ]],
        [0b0000100_1111111, [ 0b10000100, 0b01111111 ]],
        [0b0001000_1111111, [ 0b10001000, 0b01111111 ]],
        [0b0010000_1111111, [ 0b10010000, 0b01111111 ]],
        [0b0100000_1111111, [ 0b10100000, 0b01111111 ]],
        [0b1000000_1111111, [ 0b11000000, 0b01111111 ]],

        [0b0000001_1111111_1111111, [ 0b10000001, 0b11111111, 0b01111111 ]],
        [0b0000011_1111111_1111111, [ 0b10000011, 0b11111111, 0b01111111 ]],
        [0b0000111_1111111_1111111, [ 0b10000111, 0b11111111, 0b01111111 ]],
        [0b0001111_1111111_1111111, [ 0b10001111, 0b11111111, 0b01111111 ]],
        [0b0011111_1111111_1111111, [ 0b10011111, 0b11111111, 0b01111111 ]],
        [0b0111111_1111111_1111111, [ 0b10111111, 0b11111111, 0b01111111 ]],
        [0b1111111_1111111_1111111, [ 0b11111111, 0b11111111, 0b01111111 ]],

        [0b0000001_1111111_1111110, [ 0b10000001, 0b11111111, 0b01111110 ]],
        [0b0000011_1111111_1111100, [ 0b10000011, 0b11111111, 0b01111100 ]],
        [0b0000111_1111111_1111000, [ 0b10000111, 0b11111111, 0b01111000 ]],
        [0b0001111_1111111_1110000, [ 0b10001111, 0b11111111, 0b01110000 ]],
        [0b0011111_1111111_1100000, [ 0b10011111, 0b11111111, 0b01100000 ]],
        [0b0111111_1111111_1000000, [ 0b10111111, 0b11111111, 0b01000000 ]],
        [0b1111111_1111111_0000000, [ 0b11111111, 0b11111111, 0b00000000 ]],

        [0b0000001_1111111_0111110, [ 0b10000001, 0b11111111, 0b00111110 ]],
        [0b0000011_1111110_1111100, [ 0b10000011, 0b11111110, 0b01111100 ]],
        [0b0000111_1111101_1111000, [ 0b10000111, 0b11111101, 0b01111000 ]],
        [0b0001111_1111011_1110000, [ 0b10001111, 0b11111011, 0b01110000 ]],
        [0b0011111_1110111_1100000, [ 0b10011111, 0b11110111, 0b01100000 ]],
        [0b0111111_1101111_1000000, [ 0b10111111, 0b11101111, 0b01000000 ]],
        [0b1111111_1011111_0000000, [ 0b11111111, 0b11011111, 0b00000000 ]],

        [0b0000001_1111111_1111111_1111111, [ 0b10000001, 0b11111111, 0b11111111, 0b01111111 ]],
        [0b0000011_1111111_1111111_1111111, [ 0b10000011, 0b11111111, 0b11111111, 0b01111111 ]],
        [0b0000111_1111111_1111111_1111111, [ 0b10000111, 0b11111111, 0b11111111, 0b01111111 ]],
        [0b0001111_1111111_1111111_1111111, [ 0b10001111, 0b11111111, 0b11111111, 0b01111111 ]],
        [0b0011111_1111111_1111111_1111111, [ 0b10011111, 0b11111111, 0b11111111, 0b01111111 ]],
        [0b0111111_1111111_1111111_1111111, [ 0b10111111, 0b11111111, 0b11111111, 0b01111111 ]],
    ]


    it('decodes values correctly', () => {
        for (let example of examples) {
            let bytes = <number[]>example[1];
            let expected = <number>example[0];
            let result = decode(bytes);
            if (result === expected)
                continue;
            expect(result).to.eql(expected, 
                `Expected [${bytes.map(x => `0b${x.toString(2)}`).join(', ')}]`
                + ` to decode to 0b${expected.toString(2)}, not 0b${result.toString(2)}`
            );
        }
    });

    it('encodes values correctly', () => {
        for (let example of examples)
            expect(encode(<number>example[0])).to.eql(<number[]>example[1]);
    });
});