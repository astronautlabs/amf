import { expect } from "chai";
import { describe } from "razmin";
import { EcmaArrayValue, Value } from "./amf0";
import * as fs from 'fs/promises';
import * as path from 'path';

describe("amf0", it => {
    async function sample(name : string) {
        return await fs.readFile(path.join(__dirname, '..', 'test', 'amf0', `${name}.bin`));
    }

    async function parsedSample(name : string) {
        return Value.deserialize(await sample(name));
    }

    let samples = {
        'undefined':                    Value.undefined,
        'null':                         Value.null,
        'boolean-false':                Value.boolean(false),
        'boolean-true':                 Value.boolean(true),
        'number':                       Value.number(8745291.56),
        'string.hello':                 Value.string('hello'),
        'date':                         Value.date(new Date(8745291.56)),
        'strict-array-of-3-nulls':      Value.array([ null, null, null ]),
        'strict-array-of-3-booleans':   Value.array([ false, true, false ]),
        'strict-array-of-3-numbers':    Value.array([ 155.4, -62.3, 95324 ]),
        'object':                       Value.object({ a: true, b: false }),
        'ecma-array':                   Value.associativeArray({ a: true, b: false, c: true })
        
        // 'array-of-3-falses':             Value.array([ Value.boolean(false), Value.boolean(false), Value.boolean(false) ]),
        // 'array-of-3-trues':              Value.array([ Value.boolean(true), Value.boolean(true), Value.boolean(true) ]),
        // 'array-of-3-nulls':              Value.array([ Value.null, Value.null, Value.null ]),
        // 'array-of-3-integers':           Value.array([ Value.int(3), Value.int(2), Value.int(1) ]),
        // 'vector-of-3-integers':          Value.vector(Int32Array.from([ 1, 2, 3 ])),
        // 'vector-of-3-integers-2':        Value.vector(Int32Array.from([ -5, 2, 3 ])),
        // 'fixed-vector-of-3-integers':    Value.vector(Int32Array.from([ 1, 2, 3 ]), true),
        // 'vector-of-3-unsigned-integers': Value.vector(Uint32Array.from([ 1, 2, 3 ])),
        // 'simple-object-1':               Value.object({ a: Value.int(3), b: Value.int(7) }),
    };

    let files = Object.keys(samples);
    let hasAt = files.some(x => x.startsWith('@'));
    let _it = it;
    
    //globalThis.BITSTREAM_TRACE = true;

    for (let fileName of files) {
        let value = samples[fileName];
        let isAt = fileName.startsWith('@');
        let it = hasAt ? (!isAt ? _it.skip : _it.only) : _it;
        
        it(`parses sample '${fileName}' correctly`, async () => {
            let buf = await sample(fileName.replace(/^@/, ''));
            let parsedValue = Value.deserialize(buf);
            expect(`${parsedValue.constructor.name}#${JSON.stringify(parsedValue)}`).to.eql(`${value.constructor.name}#${JSON.stringify(value)}`);
            expect(parsedValue.value).to.eql(value.value);
        });
    }
});