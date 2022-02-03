# @/amf

> **[📜 Adobe AMF version 0](https://wwwimages2.adobe.com/content/dam/acom/en/devnet/pdf/amf0-file-format-specification.pdf)**  
> Adobe's Action Message Format v0

> **[📜 Adobe AMF version 3](https://www.adobe.com/content/dam/acom/en/devnet/pdf/amf-file-format-spec.pdf)**  
> Adobe’s Action Message Format v3

> 📺 Part of the **Astronaut Labs Broadcast Suite**  
> [@/is04](https://github.com/astronautlabs/is04) |
> [@/rfc8331](https://github.com/astronautlabs/rfc8331) |
> [@/rtp](https://github.com/astronautlabs/rtp) |
> [@/scte104](https://github.com/astronautlabs/scte104) | 
> [@/scte35](https://github.com/astronautlabs/scte35) | 
> [@/st2010](https://github.com/astronautlabs/st2010) | 
> [@/st291](https://github.com/astronautlabs/st291)

> 📝 **Alpha Quality**  
> This library is new, no compatibility is currently guaranteed between 
> releases (beta, semver 0.0.x).

---

# Installation

```
npm i @astronautlabs/amf
```

# Usage

```typescript

import { AMF0, AMF3 } from '@astronautlabs/amf';

// Encode AMF values

let encoded : Uint8Array;
encoded = AMF0.Value.any(123).serialize();
encoded = AMF0.Value.any(false).serialize();
encoded = AMF0.Value.any(null).serialize();
encoded = AMF0.Value.any({ hello: 'world' }).serialize();
encoded = AMF0.Value.any([ 1, 2, "types", "are", "good" ]).serialize();

// Be specific about types

encoded = AMF3.Value.vector(Int32Array.from([0,1,2,3]));

// Transparent passthrough of existing AMF values

encoded = AMF3.Value.object({ 
    foo: 123,
    bar: AMF3.Value.dictionary({
        baz: 321,
        fizz: 'hello'
    })
})

// Decode values (from Uint8Array/Buffer)

let decoded : AMF0.Value = AMF0.Value.deserialize(encoded);
```
