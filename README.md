# @/amf

> **[📜 Adobe AMF version 0](https://rtmp.veriskope.com/pdf/amf0-file-format-specification.pdf)**  
> Adobe's Action Message Format v0

> **[📜 Adobe AMF version 3](https://rtmp.veriskope.com/pdf/amf3-file-format-spec.pdf)**  
> Adobe’s Action Message Format v3

> 📺 Part of the [**Astronaut Labs Broadcast Suite**](https://github.com/astronautlabs/broadcast)
>
> See also:
> - [@/rtmp](https://github.com/astronautlabs/rtmp) - Adobe's Real Time Messaging Protocol (RTMP)
> - [@/flv](https://github.com/astronautlabs/flv) - Adobe's Flash Video format (FLV)

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
