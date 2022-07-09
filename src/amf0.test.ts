import { expect, should } from "chai";
import { describe } from "razmin";
import { BooleanValue, EcmaArrayValue, ReferenceValue, StrictArrayValue, Value } from "./amf0";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as AMF3 from './amf3';

let zeroPad = (a : string, length = 2) => {
    while (a.length < length)
        a = '0' + a;
    return a;
}

let hex = (b : Uint8Array) => Array.from(b).map(b => zeroPad(b.toString(16))).join(' ');


describe("amf0", it => {
    async function sample(name : string) {
        return await fs.readFile(path.join(__dirname, '..', 'test', 'amf0', `${name}.bin`));
    }

    async function parsedSample(name : string) {
        return Value.deserialize(await sample(name));
    }

    let longText = fs.readFile(path.join(__dirname, '..', 'test', 'long-string.txt'));

    let samples = {
        'undefined':                    Value.undefined,
        'null':                         Value.null,
        'boolean-false':                Value.boolean(false),
        'boolean-true':                 Value.boolean(true),
        'number':                       Value.number(8745291.56),
        'string.hello':                 Value.string('hello'),
        'date':                         Value.date(new Date(8745291)),
        'strict-array-of-3-nulls':      Value.array([ null, null, null ]),
        'strict-array-of-3-booleans':   Value.array([ false, true, false ]),
        'strict-array-of-3-numbers':    Value.array([ 155.4, -62.3, 95324 ]),
        'object':                       Value.object({ a: true, b: false }),
        'typed-object':                 Value.object({ a: true, b: false }, 'foo'),
        'ecma-array':                   Value.associativeArray({ a: true, b: false, c: true }),
        'long-string':                  longText.then(buf => Value.string(buf.toString())),
        'xml-document':                 longText.then(buf => Value.xmlDocument(buf.toString())),
        'avmplus':                      Value.amf3(AMF3.Value.int(18))
    };

    let files = Object.keys(samples);
    let hasAt = files.some(x => x.startsWith('@'));
    let _it = it;
    
    //globalThis.BITSTREAM_TRACE = true;

    for (let fileName of files) {
        let valueOrPromise : Value | Promise<Value> = samples[fileName];
        let isAt = fileName.startsWith('@');
        let it = hasAt ? (!isAt ? _it.skip : _it.only) : _it;
        
        it(`reads sample '${fileName}' correctly`, async () => {
            let value : Value;
            if (valueOrPromise instanceof Promise)
                value = await valueOrPromise;
            else
                value = valueOrPromise;

            let buf = await sample(fileName.replace(/^@/, ''));
            let parsedValue = Value.deserialize(buf);
            let isLargeValue = typeof parsedValue.value === 'string' && parsedValue.value.length > 50000;

            if (isLargeValue) {
                // long-string failures are just a flood
                let parsedStr = `${parsedValue.constructor.name}#${JSON.stringify(parsedValue).replace(`${parsedValue.value}`, `...`)}`;
                let expectedStr = `${value.constructor.name}#${JSON.stringify(value).replace(`${value.value}`, `...`)}`;

                expect(parsedStr).to.equal(expectedStr);
            } else {
                expect(`${parsedValue.constructor.name}#${JSON.stringify(parsedValue)}`).to.eql(`${value.constructor.name}#${JSON.stringify(value)}`);
            }
            
            try {
                expect(parsedValue.value).to.eql(value.value);
            } catch (e) {
                if (isLargeValue) {
                    expect(false, "JS representation should match").to.be.true
                }
                throw e;
            }
        });

        it(`writes sample '${fileName}' correctly`, async () => {
            let value : Value;
            if (valueOrPromise instanceof Promise)
                value = await valueOrPromise;
            else
                value = valueOrPromise;

            let expected = await sample(fileName.replace(/^@/, ''));

            expect(hex(value.serialize())).to.eql(hex(expected));
        });

        it(`roundtrips '${fileName}' correctly after reading`, async () => {
            let value : Value;
            if (valueOrPromise instanceof Promise)
                value = await valueOrPromise;
            else
                value = valueOrPromise;

            let expected = await sample(fileName.replace(/^@/, ''));
            let result = Value.deserialize(expected).serialize();

            expect(hex(result)).to.eql(hex(expected));
        });

        it(`roundtrips '${fileName}' correctly after writing`, async () => {

            let value : Value;
            if (valueOrPromise instanceof Promise)
                value = await valueOrPromise;
            else
                value = valueOrPromise;
            
            let result = Value.deserialize(value.serialize())
            expect(`${result.constructor.name}#${JSON.stringify(result)}`).to.eql(`${value.constructor.name}#${JSON.stringify(value)}`);
            expect(result.value).to.eql(value.value);
        });
    }

    it('should unroll references correctly', async () => {
        // Value.array([ [true, false], new ReferenceValue().with({ index: 0 }) ])
        let ref = <StrictArrayValue> await parsedSample('reference');

        expect(ref.value.length).to.equal(2);
        expect(ref.value).to.eql([ [true, false], [true, false] ]);
        expect('values' in ref, "StrictArrayValue#values refactored?").to.be.true;

        let values : Value[] = (ref as any).values;
        let arrayValue = values[0].as(StrictArrayValue);
        let refValue = values[1].as(ReferenceValue);

        expect(refValue.index).to.equal(0);
        expect(refValue.reference).to.equal(arrayValue);
    });
    it('should roll references correctly', async () => {
        let value = Value.array([ [true, false], [true, false]])
        let buf = value.serialize();
        expect(hex(buf)).to.equal(hex(await sample('reference')));
    });

    describe('Value', it => {
        it('unrolls JS values into appropriate AMF0 values', () => {
            let array = Value.array([ [true, false], [true, false]]);
            let values = StrictArrayValue.elementValues(array);

            expect(values.length).to.equal(2);

            let sub1 = values[0].as<StrictArrayValue>(StrictArrayValue);
            let sub2 = values[1].as<StrictArrayValue>(StrictArrayValue);

            let bool1 = StrictArrayValue.elementValues(sub1)[0];
            let bool2 = StrictArrayValue.elementValues(sub1)[1];
            let bool3 = StrictArrayValue.elementValues(sub2)[0];
            let bool4 = StrictArrayValue.elementValues(sub2)[1];

            expect(bool1).to.be.an.instanceOf(BooleanValue);
            expect(bool2).to.be.an.instanceOf(BooleanValue);
            expect(bool3).to.be.an.instanceOf(BooleanValue);
            expect(bool4).to.be.an.instanceOf(BooleanValue);
            
        });
        it.only('accepts an object with an array and creates correct AMF objects', () => {
            let amf = Value.any({ foo: [ 'bar', 'baz' ]});
        })
    });
});