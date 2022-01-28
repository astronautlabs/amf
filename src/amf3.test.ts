import { describe } from "razmin";
import { IntVectorValue, Value } from "./amf3";
import * as path from 'path';
import * as fs from 'fs/promises';
import { expect } from 'chai';

describe('amf3', it => {
    let samples = {
        'undefined': Value.undefined,
        'null': Value.null,
        'boolean-false': Value.boolean(false),
        'boolean-true': Value.boolean(true),
        'integer.19': Value.int(19),
        'integer.120': Value.int(120),
        'integer.3327': Value.int(3327),
        'double.102.5': Value.double(102.5),
        'double.8745291.56': Value.double(8745291.56),
        'string.hello': Value.string('hello'),
        'string.340': Value.string('0gl7klwtsOHw8B7fNFHzHzkwb1TEiWDEjN1XK06qxUvwcgVAF61Xy73CBs8ghWW9JXbIo8hLHau78n03jad3h8cv3iQuk5Bopx9t1hHXk2vV1nqmuYWdfR2FPAw01J0GV8ey5CLzPc8zdtrCAsO7J7Zqtlah5Annaykwro3ETENETlJDTNsJguArA2g0EqZ1gFH8EptbB1qeCoMHcHS8VT4FplWTOwgwCmGx6SubMKZ8alfpufz3nPjzCFtsdqdmP1gpW0PSP8cnz64e4ZzLiJsG8s8HiBVW4656NIPQRZFLvXHSF8pmvis5m3rVTISHooegzwvwKXiZKwrqykYx'),
        'xml-document.340': Value.xmlDocument('0gl7klwtsOHw8B7fNFHzHzkwb1TEiWDEjN1XK06qxUvwcgVAF61Xy73CBs8ghWW9JXbIo8hLHau78n03jad3h8cv3iQuk5Bopx9t1hHXk2vV1nqmuYWdfR2FPAw01J0GV8ey5CLzPc8zdtrCAsO7J7Zqtlah5Annaykwro3ETENETlJDTNsJguArA2g0EqZ1gFH8EptbB1qeCoMHcHS8VT4FplWTOwgwCmGx6SubMKZ8alfpufz3nPjzCFtsdqdmP1gpW0PSP8cnz64e4ZzLiJsG8s8HiBVW4656NIPQRZFLvXHSF8pmvis5m3rVTISHooegzwvwKXiZKwrqykYx'),
        'xml.340': Value.xml('0gl7klwtsOHw8B7fNFHzHzkwb1TEiWDEjN1XK06qxUvwcgVAF61Xy73CBs8ghWW9JXbIo8hLHau78n03jad3h8cv3iQuk5Bopx9t1hHXk2vV1nqmuYWdfR2FPAw01J0GV8ey5CLzPc8zdtrCAsO7J7Zqtlah5Annaykwro3ETENETlJDTNsJguArA2g0EqZ1gFH8EptbB1qeCoMHcHS8VT4FplWTOwgwCmGx6SubMKZ8alfpufz3nPjzCFtsdqdmP1gpW0PSP8cnz64e4ZzLiJsG8s8HiBVW4656NIPQRZFLvXHSF8pmvis5m3rVTISHooegzwvwKXiZKwrqykYx'),
        'date': Value.date(new Date('2020-03-01 12:23:34')),
        'array-of-3-falses': Value.array([ Value.boolean(false), Value.boolean(false), Value.boolean(false) ]),
        'array-of-3-trues': Value.array([ Value.boolean(true), Value.boolean(true), Value.boolean(true) ]),
        'array-of-3-nulls': Value.array([ Value.null, Value.null, Value.null ]),
        'array-of-3-integers': Value.array([ Value.int(3), Value.int(2), Value.int(1) ]),
        'vector-of-3-integers': Value.vector(Int32Array.from([ 1, 2, 3 ])),
        'vector-of-3-integers-2': Value.vector(Int32Array.from([ -5, 2, 3 ])),
        'fixed-vector-of-3-integers': Value.vector(Int32Array.from([ 1, 2, 3 ]), true),
        'vector-of-3-unsigned-integers': Value.vector(Uint32Array.from([ 1, 2, 3 ])),
    };

    let files = Object.keys(samples);
    let hasAt = files.some(x => x.startsWith('@'));
    let _it = it;
    
    for (let fileName of files) {
        let value = samples[fileName];
        let isAt = fileName.startsWith('@');
        let filePath = fileName.replace(/\//g, path.sep).replace(/^@/, '');
        let it = hasAt ? (!isAt ? _it.skip : _it.only) : _it;
        
        it(`parses sample '${fileName}' correctly`, async () => {
            let buf = await fs.readFile(path.join(__dirname, '..', 'test', 'amf3', `${filePath}.bin`));
            let parsedValue = Value.deserialize(buf);
            expect(`${parsedValue.constructor.name}#${JSON.stringify(parsedValue)}`).to.eql(`${value.constructor.name}#${JSON.stringify(value)}`);
        });
    }


});