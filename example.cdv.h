/**
   Header comment by default is included
*/
#if defined(__COMPILEDATAVIEW__)
   #pragma comments(true)              // include all block comments
   #pragma json(true)                  // include JSON methods
   #pragma language(typescript/node)   // use TypeScript with Node style string buffers
#endif

// Line comments are always ignored

enum Masks {
   a = 1 << 31,
   b = 0x00FF0000,
   c = 0b001100,
   notC = ~c
};

/*
   Because "#pragma comments(true)" is enabled, this block comment
   will be included in the output
*/
#if defined(__COMPILEDATAVIEW__)
	#pragma import({ MyIntegers } from "./MyIntegers" implements MyIntegers)     // generates "import { MyIntegers } from "./MyIntegers" to get interfaces types
	#pragma extends(MyInterface)
#endif

struct Integers {
   /* block comments also work here */
   uint16_t size;
   /**
      Multi-line JSDocs format works as well
   */
   uint32_t source;
   int8_t id;
   int16_t origin;
   uint8_t uuid[16];
};

#if defined(__COMPILEDATAVIEW__)
	#pragma extends()    // disable extends for remaining
	#pragma comments(false)      // all block comments will be ignored from here down
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
   uint32_t bar:2;
   uint32_t grr:4;
   uint32_t zrr:16;
   uint32_t yrr:4;
};


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
