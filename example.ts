let isLittleEndian = !!new Uint8Array(new Uint16Array([1]).buffer)[0];

export enum Masks {
   a = -2147483648,
   b = 16711680,
   c = 12,
   notC = -13,
};

export class Integers extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 28);
       else
         super(new ArrayBuffer(28));
   }
   get size(): number {
      return this.getUint16(0, isLittleEndian);
   }
   set size(value: number) {
      this.setUint16(0, value, isLittleEndian);
   }
   get source(): number {
      return this.getUint32(4, isLittleEndian);
   }
   set source(value: number) {
      this.setUint32(4, value, isLittleEndian);
   }
   get id(): number {
      return this.getInt8(8);
   }
   set id(value: number) {
      this.setInt8(8, value);
   }
   get origin(): number {
      return this.getInt16(10, isLittleEndian);
   }
   set origin(value: number) {
      this.setInt16(10, value, isLittleEndian);
   }
   get uuid(): Uint8Array {
      return new Uint8Array(this.buffer, this.byteOffset + 12, 16);
   }
   set uuid(value: ArrayLike<number>) {
      for (let i = 0, j = this.byteOffset + 12; i < 16; i++, j += 1)
         this.setUint8(j, value[i]);
   }
   toJSON(): object {
      return {
         size: this.size,
         source: this.source,
         id: this.id,
         origin: this.origin,
         uuid: Array.from(this.uuid),
      };
   }
   static from(obj: object): Integers {
      const result = new Integers;
      if ("size" in obj) result.size = (<Integers> obj).size;
      if ("source" in obj) result.source = (<Integers> obj).source;
      if ("id" in obj) result.id = (<Integers> obj).id;
      if ("origin" in obj) result.origin = (<Integers> obj).origin;
      if ("uuid" in obj) result.uuid = (<Integers> obj).uuid;
      return result;
   }
}

export class CharacterAndStrings extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 16);
       else
         super(new ArrayBuffer(16));
   }
   get a(): string {
      return String.fromCharCode(this.getUint8(0));
   }
   set a(value: string) {
      this.setUint8(0, value.charCodeAt(0));
   }
   get b(): string {
      return new TextDecoder().decode(this.buffer.slice(1, this.byteOffset + 16));
   }
   set b(value: string) {
      const arrayValue = new TextEncoder().encode(value);
      const byteLength = arrayValue.byteLength;
      if (byteLength > 15)
         throw new Error("too long");
      for (let i = 0; i < byteLength; i++)
         this.setUint8(1 + i, arrayValue[i]);
      for (let i = byteLength; i < 15; i++)
         this.setUint8(1 + i, 0);
   }
   toJSON(): object {
      return {
         a: this.a,
         b: this.b,
      };
   }
   static from(obj: object): CharacterAndStrings {
      const result = new CharacterAndStrings;
      if ("a" in obj) result.a = (<CharacterAndStrings> obj).a;
      if ("b" in obj) result.b = (<CharacterAndStrings> obj).b;
      return result;
   }
}

export class BooleansAndBitFields extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 4);
       else
         super(new ArrayBuffer(4));
   }
   get b1(): boolean {
      return Boolean(this.getUint32(0, isLittleEndian) & 0x1);
   }
   set b1(value: boolean) {
      const t = this.getUint32(0, isLittleEndian);
      this.setUint32(0, value ? (t | 0x1) : (t & 0xFFFFFFFE), isLittleEndian);
   }
   get b2(): boolean {
      return Boolean(this.getUint32(0, isLittleEndian) & 0x2);
   }
   set b2(value: boolean) {
      const t = this.getUint32(0, isLittleEndian);
      this.setUint32(0, value ? (t | 0x2) : (t & 0xFFFFFFFD), isLittleEndian);
   }
   get b3(): boolean {
      return Boolean(this.getUint32(0, isLittleEndian) & 0x4);
   }
   set b3(value: boolean) {
      const t = this.getUint32(0, isLittleEndian);
      this.setUint32(0, value ? (t | 0x4) : (t & 0xFFFFFFFB), isLittleEndian);
   }
   get foo(): number {
      return (this.getUint32(0, isLittleEndian) >> 3) & 0x1;
   }
   set foo(value: number) {
      const t = this.getUint32(0, isLittleEndian);
      this.setUint32(0, (value & 1) ? (t | 0x8) : (t & 0xFFFFFFF7), isLittleEndian);
   }
   get bar(): number {
      return (this.getUint32(0, isLittleEndian) >> 4) & 0x3;
   }
   set bar(value: number) {
      const t = this.getUint32(0, isLittleEndian) & 0xFFFFFFCF;
      this.setUint32(0, t | ((value & 0x3) << 4), isLittleEndian);
   }
   get grr(): number {
      return (this.getUint32(0, isLittleEndian) >> 6) & 0xF;
   }
   set grr(value: number) {
      const t = this.getUint32(0, isLittleEndian) & 0xFFFFFC3F;
      this.setUint32(0, t | ((value & 0xF) << 6), isLittleEndian);
   }
   get zrr(): number {
      return (this.getUint32(0, isLittleEndian) >> 10) & 0xFFFF;
   }
   set zrr(value: number) {
      const t = this.getUint32(0, isLittleEndian) & 0xFC0003FF;
      this.setUint32(0, t | ((value & 0xFFFF) << 10), isLittleEndian);
   }
   get yrr(): number {
      return (this.getUint32(0, isLittleEndian) >> 26) & 0xF;
   }
   set yrr(value: number) {
      const t = this.getUint32(0, isLittleEndian) & 0xC3FFFFFF;
      this.setUint32(0, t | ((value & 0xF) << 26), isLittleEndian);
   }
   toJSON(): object {
      return {
         b1: this.b1,
         b2: this.b2,
         b3: this.b3,
         foo: this.foo,
         bar: this.bar,
         grr: this.grr,
         zrr: this.zrr,
         yrr: this.yrr,
      };
   }
   static from(obj: object): BooleansAndBitFields {
      const result = new BooleansAndBitFields;
      if ("b1" in obj) result.b1 = (<BooleansAndBitFields> obj).b1;
      if ("b2" in obj) result.b2 = (<BooleansAndBitFields> obj).b2;
      if ("b3" in obj) result.b3 = (<BooleansAndBitFields> obj).b3;
      if ("foo" in obj) result.foo = (<BooleansAndBitFields> obj).foo;
      if ("bar" in obj) result.bar = (<BooleansAndBitFields> obj).bar;
      if ("grr" in obj) result.grr = (<BooleansAndBitFields> obj).grr;
      if ("zrr" in obj) result.zrr = (<BooleansAndBitFields> obj).zrr;
      if ("yrr" in obj) result.yrr = (<BooleansAndBitFields> obj).yrr;
      return result;
   }
}

export class FloatAndBigInts extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 48);
       else
         super(new ArrayBuffer(48));
   }
   get f32(): number {
      return this.getFloat32(0, isLittleEndian);
   }
   set f32(value: number) {
      this.setFloat32(0, value, isLittleEndian);
   }
   get f64(): Float64Array {
      return new Float64Array(this.buffer, this.byteOffset + 8, 2);
   }
   set f64(value: ArrayLike<number>) {
      for (let i = 0, j = this.byteOffset + 8; i < 2; i++, j += 8)
         this.setFloat64(j, value[i], isLittleEndian);
   }
   get big(): bigint {
      return this.getBigInt64(24, isLittleEndian);
   }
   set big(value: bigint) {
      this.setBigInt64(24, value, isLittleEndian);
   }
   get bigger(): BigUint64Array {
      return new BigUint64Array(this.buffer, this.byteOffset + 32, 2);
   }
   set bigger(value: ArrayLike<bigint>) {
      for (let i = 0, j = this.byteOffset + 32; i < 2; i++, j += 8)
         this.setBigUint64(j, value[i], isLittleEndian);
   }
   toJSON(): object {
      return {
         f32: this.f32,
         f64: Array.from(this.f64),
         big: this.big,
         bigger: Array.from(this.bigger),
      };
   }
   static from(obj: object): FloatAndBigInts {
      const result = new FloatAndBigInts;
      if ("f32" in obj) result.f32 = (<FloatAndBigInts> obj).f32;
      if ("f64" in obj) result.f64 = (<FloatAndBigInts> obj).f64;
      if ("big" in obj) result.big = (<FloatAndBigInts> obj).big;
      if ("bigger" in obj) result.bigger = (<FloatAndBigInts> obj).bigger;
      return result;
   }
}

export class EmbedAll extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 96);
       else
         super(new ArrayBuffer(96));
   }
   get i(): Integers {
      return new Integers(this.buffer, this.byteOffset);
   }
   set i(value: Integers) {
      for (let i = 0; i < 28; i++)
         this.setUint8(i + 0, value.getUint8(i));
   }
   get b(): BooleansAndBitFields {
      return new BooleansAndBitFields(this.buffer, this.byteOffset + 28);
   }
   set b(value: BooleansAndBitFields) {
      for (let i = 0; i < 4; i++)
         this.setUint8(i + 28, value.getUint8(i));
   }
   get c(): CharacterAndStrings {
      return new CharacterAndStrings(this.buffer, this.byteOffset + 32);
   }
   set c(value: CharacterAndStrings) {
      for (let i = 0; i < 16; i++)
         this.setUint8(i + 32, value.getUint8(i));
   }
   get f(): FloatAndBigInts {
      return new FloatAndBigInts(this.buffer, this.byteOffset + 48);
   }
   set f(value: FloatAndBigInts) {
      for (let i = 0; i < 48; i++)
         this.setUint8(i + 48, value.getUint8(i));
   }
   toJSON(): object {
      return {
         i: this.i.toJSON(),
         b: this.b.toJSON(),
         c: this.c.toJSON(),
         f: this.f.toJSON(),
      };
   }
   static from(obj: object): EmbedAll {
      const result = new EmbedAll;
      if ("i" in obj) result.i = Integers.from((<EmbedAll> obj).i);
      if ("b" in obj) result.b = BooleansAndBitFields.from((<EmbedAll> obj).b);
      if ("c" in obj) result.c = CharacterAndStrings.from((<EmbedAll> obj).c);
      if ("f" in obj) result.f = FloatAndBigInts.from((<EmbedAll> obj).f);
      return result;
   }
}

export class UnionAll extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 49);
       else
         super(new ArrayBuffer(49));
   }
   get kind(): number {
      return this.getUint8(0);
   }
   set kind(value: number) {
      this.setUint8(0, value);
   }
   get text(): string {
      return new TextDecoder().decode(this.buffer.slice(1, this.byteOffset + 17));
   }
   set text(value: string) {
      const arrayValue = new TextEncoder().encode(value);
      const byteLength = arrayValue.byteLength;
      if (byteLength > 16)
         throw new Error("too long");
      for (let i = 0; i < byteLength; i++)
         this.setUint8(1 + i, arrayValue[i]);
      for (let i = byteLength; i < 16; i++)
         this.setUint8(1 + i, 0);
   }
   get i(): Integers {
      return new Integers(this.buffer, this.byteOffset + 1);
   }
   set i(value: Integers) {
      for (let i = 0; i < 28; i++)
         this.setUint8(i + 1, value.getUint8(i));
   }
   get b(): BooleansAndBitFields {
      return new BooleansAndBitFields(this.buffer, this.byteOffset + 1);
   }
   set b(value: BooleansAndBitFields) {
      for (let i = 0; i < 4; i++)
         this.setUint8(i + 1, value.getUint8(i));
   }
   get c(): CharacterAndStrings {
      return new CharacterAndStrings(this.buffer, this.byteOffset + 1);
   }
   set c(value: CharacterAndStrings) {
      for (let i = 0; i < 16; i++)
         this.setUint8(i + 1, value.getUint8(i));
   }
   get f(): FloatAndBigInts {
      return new FloatAndBigInts(this.buffer, this.byteOffset + 1);
   }
   set f(value: FloatAndBigInts) {
      for (let i = 0; i < 48; i++)
         this.setUint8(i + 1, value.getUint8(i));
   }
   toJSON(): object {
      return {
         kind: this.kind,
         text: this.text,
         i: this.i.toJSON(),
         b: this.b.toJSON(),
         c: this.c.toJSON(),
         f: this.f.toJSON(),
      };
   }
   static from(obj: object): UnionAll {
      const result = new UnionAll;
      if ("kind" in obj) result.kind = (<UnionAll> obj).kind;
      if ("text" in obj) result.text = (<UnionAll> obj).text;
      if ("i" in obj) result.i = Integers.from((<UnionAll> obj).i);
      if ("b" in obj) result.b = BooleansAndBitFields.from((<UnionAll> obj).b);
      if ("c" in obj) result.c = CharacterAndStrings.from((<UnionAll> obj).c);
      if ("f" in obj) result.f = FloatAndBigInts.from((<UnionAll> obj).f);
      return result;
   }
}

export class Ints extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 4);
       else
         super(new ArrayBuffer(4));
   }
   get a(): number {
      return this.getUint8(0);
   }
   set a(value: number) {
      this.setUint8(0, value);
   }
   get b(): number {
      return this.getUint16(0, isLittleEndian);
   }
   set b(value: number) {
      this.setUint16(0, value, isLittleEndian);
   }
   get c(): number {
      return this.getUint32(0, isLittleEndian);
   }
   set c(value: number) {
      this.setUint32(0, value, isLittleEndian);
   }
   toJSON(): object {
      return {
         a: this.a,
         b: this.b,
         c: this.c,
      };
   }
   static from(obj: object): Ints {
      const result = new Ints;
      if ("a" in obj) result.a = (<Ints> obj).a;
      if ("b" in obj) result.b = (<Ints> obj).b;
      if ("c" in obj) result.c = (<Ints> obj).c;
      return result;
   }
}

export class FloatArray extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 8);
       else
         super(new ArrayBuffer(8));
   }
   get f(): Float32Array {
      return new Float32Array(this.buffer, this.byteOffset, 2);
   }
   set f(value: ArrayLike<number>) {
      for (let i = 0, j = this.byteOffset; i < 2; i++, j += 4)
         this.setFloat32(j, value[i], isLittleEndian);
   }
   toJSON(): object {
      return {
         f: Array.from(this.f),
      };
   }
   static from(obj: object): FloatArray {
      const result = new FloatArray;
      if ("f" in obj) result.f = (<FloatArray> obj).f;
      return result;
   }
}

export class JavaScriptTypes extends DataView {
   constructor(data?: ArrayBuffer, offset?: number) {
      if (data)
         super(data, offset ?? 0, 49);
       else
         super(new ArrayBuffer(49));
   }
   get au(): number {
      return this.getUint8(0);
   }
   set au(value: number) {
      this.setUint8(0, value);
   }
   get bu(): number {
      return this.getUint16(2, isLittleEndian);
   }
   set bu(value: number) {
      this.setUint16(2, value, isLittleEndian);
   }
   get cu(): number {
      return this.getUint32(4, isLittleEndian);
   }
   set cu(value: number) {
      this.setUint32(4, value, isLittleEndian);
   }
   get as(): number {
      return this.getInt8(8);
   }
   set as(value: number) {
      this.setInt8(8, value);
   }
   get bs(): number {
      return this.getInt16(10, isLittleEndian);
   }
   set bs(value: number) {
      this.setInt16(10, value, isLittleEndian);
   }
   get cs(): number {
      return this.getInt32(12, isLittleEndian);
   }
   set cs(value: number) {
      this.setInt32(12, value, isLittleEndian);
   }
   get f32(): number {
      return this.getFloat32(16, isLittleEndian);
   }
   set f32(value: number) {
      this.setFloat32(16, value, isLittleEndian);
   }
   get f64(): number {
      return this.getFloat64(24, isLittleEndian);
   }
   set f64(value: number) {
      this.setFloat64(24, value, isLittleEndian);
   }
   get b1(): bigint {
      return this.getBigInt64(32, isLittleEndian);
   }
   set b1(value: bigint) {
      this.setBigInt64(32, value, isLittleEndian);
   }
   get b2(): bigint {
      return this.getBigUint64(40, isLittleEndian);
   }
   set b2(value: bigint) {
      this.setBigUint64(40, value, isLittleEndian);
   }
   get boo(): boolean {
      return Boolean(this.getUint8(48) & 0x1);
   }
   set boo(value: boolean) {
      const t = this.getUint8(48);
      this.setUint8(48, value ? (t | 0x1) : (t & 0xFE));
   }
   toJSON(): object {
      return {
         au: this.au,
         bu: this.bu,
         cu: this.cu,
         as: this.as,
         bs: this.bs,
         cs: this.cs,
         f32: this.f32,
         f64: this.f64,
         b1: this.b1,
         b2: this.b2,
         boo: this.boo,
      };
   }
   static from(obj: object): JavaScriptTypes {
      const result = new JavaScriptTypes;
      if ("au" in obj) result.au = (<JavaScriptTypes> obj).au;
      if ("bu" in obj) result.bu = (<JavaScriptTypes> obj).bu;
      if ("cu" in obj) result.cu = (<JavaScriptTypes> obj).cu;
      if ("as" in obj) result.as = (<JavaScriptTypes> obj).as;
      if ("bs" in obj) result.bs = (<JavaScriptTypes> obj).bs;
      if ("cs" in obj) result.cs = (<JavaScriptTypes> obj).cs;
      if ("f32" in obj) result.f32 = (<JavaScriptTypes> obj).f32;
      if ("f64" in obj) result.f64 = (<JavaScriptTypes> obj).f64;
      if ("b1" in obj) result.b1 = (<JavaScriptTypes> obj).b1;
      if ("b2" in obj) result.b2 = (<JavaScriptTypes> obj).b2;
      if ("boo" in obj) result.boo = (<JavaScriptTypes> obj).boo;
      return result;
   }
}

/*
	View classes generated by https://phoddie.github.io/compileDataView on Mon Feb 07 2022 21:26:31 GMT+0000 (Coordinated Universal Time) from the following description:
*/

// #pragma typescript(true)
// #pragma json(true)
// #pragma xs(false)
// #pragma endian(host)
// 
// enum Masks {
//    a = 1 << 31,
//    b = 0x00FF0000,
//    c = 0b001100,
//    notC = ~c
// };
// 
// struct Integers {
//    uint16_t size;
//    uint32_t source;
//    int8_t id;
//    int16_t origin;
//    uint8_t uuid[16];
// };
// 
// // char is a one character String
// struct CharacterAndStrings {
//    char a;
//    char b[15];
// };
// 
// /*
//   bit-fields are stored in integer
//   of 8, 16, or 32 bits as needed.
//   boolean/bool is a 1-bit bitfield
// */
// struct BooleansAndBitFields {
//    boolean b1;
//    bool b2;
//    bool b3;
// 
//    uint32_t foo:1;
//    uint32_t bar:2;
//    uint32_t grr:4;
//    uint32_t zrr:16;
//    uint32_t yrr:4;
// };
// 
// struct FloatAndBigInts {
//    float f32;
//    double f64[2];
//    int64_t big;
//    uint64_t bigger[2];
// };
// 
// struct EmbedAll {
//    Integers i;
//    BooleansAndBitFields b;
//    CharacterAndStrings c;
//    FloatAndBigInts f;
// };
// 
// // anonymous union in struct
// struct UnionAll {
//    uint8_t kind;
//    union {
//       char text[16];
//       Integers i;
//       BooleansAndBitFields b;
//       CharacterAndStrings c;
//       FloatAndBigInts f;
//    };
// };
// 
// // named union outside struct
// union Ints {
//    uint8_t a;
//    uint16_t b;
//    uint32_t c;
// };
// 
// // typedef struct
// typedef struct {
//    float f[2];
// } FloatArray;
// 
// // JavaScript type names
// struct JavaScriptTypes {
//    Uint8 au;
//    Uint16 bu;
//    Uint32 cu;
// 
//    Int8 as;
//    Int16 bs;
//    Int32 cs;
// 
//    Float32 f32;
//    Float64 f64;
// 
//    BigInt64 b1;
//    BigUint64 b2;
// 
//    Boolean boo;
// };
// 