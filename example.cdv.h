/**
   Header comment by default is included
*/
#if defined(__COMPILEDATAVIEW__)
   #pragma comments(true)              // include all block comments
   #pragma json(true)                  // include JSON methods
   #pragma language(typescript/node)   // use TypeScript with Node style string buffers
   #pragma outputByteLength(true)      // include length of structures in output
#endif

// Line comments are always ignored

enum Masks {
   /** JSDoc style comment on a */
   a = 1 << 31,
   /** JSDoc style comment on b */
   b = 0x00FF0000,
   c = 0b001100,
   notC = ~c
};

enum SmallEnum : uint8_t {
   oneByte,
   notFour
}

/*
   Because "#pragma comments(true)" is enabled, this block comment
   will be included in the output
*/
#if defined(__COMPILEDATAVIEW__)
	#pragma import({ MyIntegers } from "./MyIntegers")     // generates "import { MyIntegers } from "./MyIntegers" to get interfaces types
	#pragma extends(DataView implements MyIntegers)
#endif

struct Integers {
   /* block comments also work here */
   uint16_t size;
   /**
      Multi-line JSDocs format works as well, included on each getter/setter of the property
   */
   uint32_t source;
   int8_t id;
   int16_t origin;
   uint8_t uuid[16];
   SmallEnum tiny;
};

#if defined(__COMPILEDATAVIEW__)
	#pragma extends()          // disable extends for remaining
#endif

/*
   This comment is ignored
*/
struct CharacterAndStrings {
   char a;                  // char is a one character String
   char b[15];
};

/*
  bit-fields are stored in integer
  of 8, 16, or 32 bits as needed.
  boolean/bool is a 1-bit bitfield
*/
struct BooleansAndBitFields {
   boolean b1;
   bool b2;
   bool b3;

   uint32_t foo:1;
   /**
    * JSDoc style works with bitfields as well (bar) 
    */
   uint32_t bar:2;
   uint32_t grr:4;
   /** JSDoc style works with bitfields as well (zrr) */
   uint32_t zrr:16;
   uint32_t yrr:4;
};

#if defined(__COMPILEDATAVIEW__)
	#pragma comments(false)      // all block comments will be ignored from here down
#endif

struct FloatAndBigInts {
   float f32;
   double f64[2];
   int64_t big;
   uint64_t bigger[2];
};

struct EmbedAll {
   Integers i;
   BooleansAndBitFields b;
   CharacterAndStrings c;
   FloatAndBigInts f;
};

// anonymous union in struct
struct UnionAll {
   uint8_t kind;
   union {
      char text[16];
      Integers i;
      BooleansAndBitFields b;
      CharacterAndStrings c;
      FloatAndBigInts f;
   };
};

// named union outside struct
union Ints {
   uint8_t a;
   uint16_t b;
   uint32_t c;
};

// typedef struct
typedef struct {
   float f[2];
} FloatArray;

// JavaScript type names
struct JavaScriptTypes {
   Uint8 au;
   Uint16 bu;
   Uint32 cu;

   Int8 as;
   Int16 bs;
   Int32 cs;

   Float32 f32;
   Float64 f64;

   BigInt64 b1;
   BigUint64 b2;

   Boolean boo;
};

// padding
struct Key {
	uint8_t __pad1[11];
	uint8_t value; 
	uint8_t __pad2;
	uint32_t id;
};

// Base class used for inheritance
struct Base {
   uint32_t b1;
   char b2;
};

// Inherits Base 
struct ExtBase : Base {
   uint16_t eb1;
   uint32_t eb2;
   char eb3;
};

enum Constants {
   MAX_SIZE = 30
};

// Inherits ExtBase
struct MoreBase : ExtBase {
   uint32_t mb1;
   char mb2;
   char mb3[MAX_SIZE];
};

// example of using injections with type literals and inheritance in TypeScript
enum TypeLiteral {
   One,
   Two
};

struct BaseLiteral {
   TypeLiteral type;
};

struct TypeOne : BaseLiteral {
   #if defined(__LANGUAGE_TYPESCRIPT__)
      #pragma injectInterface(type: TypeLiteral.One)
   #endif
   uint16_t somethingMore;
};

struct TypeTwo : BaseLiteral {
   #if defined(__LANGUAGE_TYPESCRIPT__)
      #pragma injectInterface(type: TypeLiteral.Two)
   #endif
};

#if defined(__LANGUAGE_TYPESCRIPT__)
   #pragma inject(type BaseTypes = ITypeOne | ITypeTwo)
#endif

