# CompileDataView

Copyright 2021-2022 Moddable Tech, Inc.<BR>
Author: Peter Hoddie<BR>
Revised: February 26, 2022

## Table of Contents

- [Introduction](#introduction)
  - [Example](#example)
  - [Running CompileDataView](#running)
  - [Adding the generated classes to your Moddable SDK project](#adding)
  - [Using the generated classes in your project](#using)
    - [Creating a new instance](#new)
    - [Wrapping an existing buffer](#wrapping)
    - [Getting the binary data of a view](#get-buffer)
    - [Initializing a binary data structure from JavaScript objects](#initialize)
    - [Serializing a binary data structure to JSON](#stringify)
- [Reference](#reference)
  - [Syntax](#syntax)
  - [Property types](#types)
    - [Number](#type-numbers)
    - [Array of numbers](#type-number-array)
    - [Numeric bitfield](#type-bitfields)
    - [Boolean](#type-boolean)
    - [Character](#type-character)
    - [String](#type-string)
    - [Nested types](#type-nested)
    - [Padding](#padding)
  - [Enumerations](#enum)
  - [Configuring CompileDataView using pragmas](#pragmas)
  - [Conditional Compilation](#if-else-endif)
- [Past and future](#past-future)
- [Acknowledgements](#acknowledgements)
- [Contact](#contact)


<a id="introduction"></a>
## Introduction
CompileDataView makes it easier to work with binary data structures in JavaScript. There are two big motivations to use binary data in JavaScript:

- To interoperate with existing binary data, for example to exchange binary data over a network or serial connection and to read and write a binary file format. Both of these scenarios are common for JavaScript code written for embedded systems.
- To reduce memory required for records by storing property values in a compact binary form rather than as dynamically typed JavaScript values. Memory is particularly precious on resource constrained devices.

CompileDataView is designed to be easy to adopt by developers familiar with the C programming language. Both the syntax used to define binary data structures and the JavaScript code used to work with binary data structures are similar to C. C is used as a model because many binary data structures are already defined in C and many developers working in JavaScript on embedded systems already know C.

If you want to start immediately without reading the documentation, you can [use CompileDataView in your browser](https://phoddie.github.io/compileDataView/). If you do read this document, it is valuable to copy the examples from this document and paste them into the web page to explore the various features.

<a id="example"></a>
### Example
The introduction of [DataView](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView) to JavaScript in ES6 made it possible to read and write binary records, but not pleasant. CompileDataView addresses this by allowing binary data structures to be described using a C-like syntax which is compiled to JavaScript classes. Scripts read and write values to the data structures with code that looks like the C code operating on the same structure.

Using CompileDataView, this C data structure:

```c
struct IntroView {
   int32_t a;
   uint8_t b;
   char c;
   float f;
   uint16_t data[4];
};
```

can be naturally accessed in JavaScript:

```js
let i = new IntroView;
i.a = 0x80001234;
i.b = 3;
i.c = "!";
i.f = i.a / i.b;
i.data[2] = 11;
```

To create views like `IntroView`, you provide CompileDataView with description of the binary data structure using a C-like syntax. It generates JavaScript code to implement your data structure. For this example, the description is simply the C `struct` declaration above which generates the following JavaScript:

```js
export class IntroView extends DataView {
   constructor(data, offset) {
      if (data)
         super(data, offset ?? 0, 18);
       else
         super(new ArrayBuffer(18));
   }
   get a() {
      return this.getInt32(0, true);
   }
   set a(value) {
      this.setInt32(0, value, true);
   }
   get b() {
      return this.getUint8(4);
   }
   set b(value) {
      this.setUint8(4, value);
   }
   get c() {
      return String.fromCharCode(this.getUint8(5));
   }
   set c(value) {
      return this.setUint8(5, value.charCodeAt());
   }
   get f() {
      return this.getFloat32(6, true);
   }
   set f(value) {
      this.setFloat32(6, value, true);
   }
   get data() {
      return new Uint16Array(this.buffer, this.byteOffset + 10, 8);
   }
   set data(value) {
      for (let i = 0, j = 10; i < 4; i++, j += 2)
         this.setUint16(j, value[i]);
   }
}
```

If the generated code is a little difficult to understand, don't worry: you don't need to understand the generated code to use it.

Notice that the constructor creates an `ArrayBuffer` with six bytes, which is exactly the same size as the C structure. Using dynamically typed JavaScript properties would require at least fifty-two bytes to store the same values. Of course using standard JavaScript properties executes faster and avoids the need for the `IntroView` class. However, where binary data is required or memory is tight, the reduced performance is a practical tradeoff.

The class generated by CompileDataView is designed to be natural to use in JavaScript. It doesn't try to precisely emulate the behavior of C. For example, the `c` property above is a `char` which would be an 8-bit integer in C. In JavaScript, which has a native `String` type, the `c` property is accessed as a string value.

<a id="running"></a>
### Running CompileDataView
CompileDataView is [implemented](https://github.com/phoddie/compileDataView/blob/master/compileDataView.js) as a JavaScript module so it can be incorporated into tools as needed. CompileDataView is available to use in a [web page](https://phoddie.github.io/compileDataView/) where you can easily explore its capabilities and generate classes for use in your projects, and also as a simple command line Node application (`node cli/cdv.js <input-file> {<output-file>}`).

Any errors detected in the input file are displayed in a comment at the top of the generated source code in the web page or output file, as well as output to the console along with a non-zero exit when using the CLI. CompileDataView does not stop on the first error found, so more than one error reported may be reported.

<a id="adding"></a>
### Adding the generated classes to your Moddable SDK project
The source code CompileDataView generates is intended to be used as a JavaScript module. The generated code may be used with any modern JavaScript engine.

If you are working with the Moddable SDK, here are the steps for adding the generated classes to your project as a module.

- Generate module source code using the [web page](https://phoddie.github.io/compileDataView/).
- Copy the source code into a new file, for example `dataviews.js`.
- Add the new module to your manifest. Be sure to include the new module in the `"preload"` section of the manifest. This ensures that the view classes use no RAM and that their property look-ups are as fast as possible.

```
	"modules": {
		"*": [
			"./main",
			"./dataviews"
		]
	},
	"preload": [
		"dataviews"
	]
```

- Import the new module into the modules where they will be used. The following example assumes that the `"dataview"` module exports a view named `IntroView`.

```js
import {IntroView} from "dataviews";
```

<a id="using"></a>
### Using the generated classes in your project
There are several ways to use the generated classes in your scripts. 

<a id="new"></a>
#### Creating a new instance
You can create a new a new instance of the record which allocates the memory for the view and initializes all values to zero. You don't need to pass any arguments as the class knows the size of the data structure.

```js
let record = new IntroView;
```

You can then set and get the properties you defined.

<a id="wrapping"></a>
#### Wrapping an existing buffer
If you have a buffer that contains a binary data structure already, you can wrap the view around it. This is useful when you receive a buffer of data in a known format from a network source or from reading a file. The view constructor, `ExampleView` here supports both the `buffer` and `byteOffset` parameters of the `DataView` constructor. If you have a buffer in the format of `ExampleView`, you can read its contents as follows:

```js
let record = new IntroView(buffer);
trace(record.a, "\n");
```

If the data begins somewhere inside the `buffer,` but not at offset zero, pass the byte offset as the second parameter:

```js
let record = new IntroView(buffer, 16);
trace(record.a, "\n");
```

Because views are a fixed size, the constructor does not support the optional third parameter, `byteLength`, of the `DataView` constructor.

<a id="get-buffer"></a>
#### Getting the binary data of a view
To access the binary data of the view, use the `buffer` property as with the underlying `DataView`. For example:

```js
let record = new IntroView;
record.a = 12;
file.write(record.buffer);
```

<a id="initialize"></a>
#### Initializing a binary data structure from JavaScript objects
You can create a new binary data structure and use JavaScript objects to initialize one or more of its fields.

```js
let i = IntroView.from({
	a: 0x80001234,
	b: 3,
	c: "!",
	f: i.a / i.b,
	data: [1, 2, 3, 4]
});
```

To use the `from` feature, set `#pragma json(true)` when compiling the view.

<a id="stringify"></a>
#### Serializing a binary data structure to JSON
You can create JSON output for a binary view using the standard `JSON.stringify` function.

```js
let i = new IntroView;
let json = JSON.stringify(i, null, "   ");
trace(json, "\n");
```

This capability is helpful when debugging as it allows easily outputting the entire binary data structure.

To use JSON serialization, set `#pragma json(true)` when compiling the view.

<a id="reference"></a>
## Reference
This section is explains the the binary data format description used by CompileDataView. It is very similar to C, though not identical.

<a id="syntax"></a>
### Syntax
A binary data format description contains one or more structures:

```c
struct A {
	uint8_t a;
};
typedef struct {
	uint32_t b;
} B;
```

Arrays and bitfields are supported. Unlike C, bitfields are always unsigned.

```c
struct C {
	int16_t c[4];

	uint8_t c1:4;
	uint8_t c2:2;
};
```

Anonymous unions may be embedded in a `struct`:

```c
struct D {
	uint8_t kind;
	union {
		A a;
		B b;
		C c;
	};
};
```

Comments begin with `//` and extend to the end of the line or begin with `/*` and end at `*/`. Empty lines are ignored.

The behavior of CompileDataView is controlled using [pragmas](#pragmas). For example, the `endian` pragma controls if multi-byte numbers are stored as big-endian values:

```c
#pragma endian(big)
```

> **Note**: The parser in CompileDataView is far from a full C compiler and supports only a small subset of the C language. It is intended to be familiar to C programmers but not to support all C `struct` declarations.

<a id="types"></a>
### Property types
CompileDataView supports all the types of values provided by `DataView` and adds support for smaller integers using bitfields, arrays of numbers, booleans, characters, and strings.

<a id="type-numbers"></a>
#### Numbers
All the numeric types defined by `DataView` are available: `Int8`, `Int16`, `Int32`, `Uint8`, `Uint16`, `Uint32`, `BigInt64`, `BigUint64`, `Float32`, and `Float64`.

To match the C language, `DataView` numeric types are also available using standard C type names: `int8_t`, `int16_t`, `int32_t`, `uint8_t`, `uint16_t`, `uint32_t`, `int64_t`, `uint64_t`, `float`, and `double`.

```c
struct Example {
	Int16 a;
	int16_t b;
	
	Float32 c;
	float d;
	
	double e;
	Float64 f;
};
```

<a id="type-number-array"></a>
#### Arrays of numbers
Fixed length arrays of numeric types are supported. For example, the following defines a four element array of `Int16`:

```c
struct ArrayExample {
	Int16 values[4];
};
```

Array properties may be set using a full array:

```js
let i = new ArrayExample;
i.values = Int16Array.of(1, 2, 3, 4);
i.values = [1, 2, 3, 4];
```

They may also be set by individual element:

```js
i.values[2] = 11;
```

Reading an array property returns a reference to the data as the corresponding TypedArray type. This allows scripts to use TypedArray methods, such as `fill`, on array properties.

```js
i.values.fill(0xff);
```

Each get of a numeric array property creates new TypedArray instance. Where performance is a priority, code should be written to re-use the TypedArray instance.

```js
for (let j = 0, values = i.values; j < 4; j++)
   values[j] = j;
```

<a id="type-bitfields"></a>
#### Numeric bitfields
Numeric bitfields are unsigned integer values of 1 to 31 bits. CompileDataView merges sequential bitfields into a single integer to reduce memory use.

Numeric bitfields are declared using `uint8_t`, `uint16_t`, and `uint32_t` types with C-style bitfield declarations:

```c
struct BitFields {
	uint32_t oneBit:1;
	uint32_t nybble:4;
	uint32_t mask:3;
};
```

This declaration uses a 1-byte `ArrayBuffer`.

Bitfields and arrays are mutually exclusive: you cannot have an array of bitfields.

By default the field in a bitfield are placed in the least significant free bits. To store the fields in the most significant free bits, use the `bitfields` pragma.

<a id="type-boolean"></a>
#### Boolean
Boolean values store JavaScript `true` and `false` values in a `DataView`. Boolean values are treated as a bitfield with a size of one bit. When setting the property, a truthy value is 1; when reading, the return values are `true` and `false`.

```c
struct Booleans {
	Boolean a;
	boolean b
	bool c;
};
```

Because Booleans are implemented as bitfields, arrays of Booleans are not supported.

<a id="type-character"></a>
#### Characters
JavaScript does not have a data type for a single character but because the `char` type is common in C, CompileDataView supports it:

```c
struct Character {
	char c;
};
```

The `char` type uses one byte of storage, a `Uint8` type. If the character value to be stored is greater than 255, only the low eight bits are stored. To set a character property, pass a string. The first character is stored.

```js
i.c = "a";
```

The result of reading a `char` is a one character string, not an integer as in C.

<a id="type-string"></a>
#### Strings
CompileDataView supports strings using an array of `char`. The following declares a string of 8 bytes:

```c
struct StringExample {
	char str[8];
};
```

Note that this is 8 bytes, not 8 JavaScript Unicode characters. Strings are stored in UTF-8 format.

You may set strings values shorter than the declared length, but not longer.

```js
let i = new StringExample;
i.str = "12345678"; // ok
i.str = "12"; // ok
i.str = "123456789"; // throws
```

<a id="type-nested"></a>
#### Nested types
View declared in a description can be nested in views that follow it by using the class name as the type.

```c
struct Point {
	uint16_t x;
	uint16_t y;
};

struct Rectangle {
	Point topLeft;
	Point bottomRight;
};
```

The generated classes may be used by scripts.

```js
let r = new Rectangle;

r.topLeft.x = 10;
r.topLeft.y = 20;

r.bottomRight = r.topLeft;
r.bottomRight.x += 5;
r.bottomRight.y += 5;
```

Like numeric arrays, getting the value of a nested type returns a new instance of the view referencing the original data. Therefore, it is similarly recommended to reuse the returned instance when practical.

<a id="padding"></a>
#### Padding
CompileDataView automatically omits output of property names that begin with `__pad` so that unused padding fields in a data structure do not generate any code. For example, the following outputs code for the `value` and `id` fields only.

```
struct Key {
	uint8_t __pad1[11];
	uint8_t value;
	uint8_t __pad2;
	uint32_t id;
};
```

> **Note**: This behavior deviates from standard C behavior. No pragma is provided to control it. It is straightforward to add, should it prove necessary.

<a id="enum"></a>
### Enumerations
CompileDataView supports `enum`. Expressions may be used to assign enumeration values.

```c
enum Values {
   zero,
   one,
   three = 3
};
enum Masks {
   a = 1 << 31,
   b = 0x00FF0000
};
```

In JavaScript, the enumeration values are accessed through the enumeration name:

```js
trace(Values.three, "\n");
trace(Masks.a, "\n");
```

The `enum` expressions implements some behaviors incompatible with C by supporting floating point, string, and boolean values and expressions that reference enumeration values. These are convenient in some situations.

```c
enum Zero {
   string = "0",
   almost = 0.001,
   isZero = true
};

enum PowersOfTwo {
   zero = 1,
   one = zero << 1,
   two = one ** 2,
   isZero = !Zero.isZero
};
```

<a id="pragmas"></a>
### Configuring CompileDataView using pragmas
Pragmas control how CompileDataView generates code for properties. All pragmas are optional. The defaults are designed to be reasonable and safe for use on embedded systems.

Pragmas can be changed in mid-file. For example, changing the `endian` pragma, which controls how multi-byte numbers are stored, allows CompileDataView to support obscure data structures that have both big-endian and little-endian values.

The following pragmas are available (first option is the default):

- [`bitfields(lsb | msb`](#bitfields)
- [`checkByteLength(true | false)`](#checkbytelength)
- [`comments(header | false | true)`](#comments)
- [`endian(little | big)`](#endian)
- [`export(true, false)`](#export)
- [`extends(DataView | <custom>)`](#extends)
- [`get(true | false)` and `set(true | false)`](#get-and-set)
- [`import(<import syntax>)`](#import)
- [`json(false | true)`](#json)
- [`language('javascript/xs' | <javascript | typescript>{/<xs | web | node>})`](#language)
- [`outputByteLength(false | true)`](#outputbytelength)
- [`pack(16 | 8 | 4 | 2 | 1)`](#pack)

#### `extends`
The `extends` pragma defines the name of the class the generated class extends. The default value is `DataView` and it is rarely necessary to use another value. For example, the following pragma

```c
#pragma extends(CustomDataView)
```

generates the following class declaration:

```js
class CompiledDataView extends CustomDataView {
...
```

The entire content of the pragma is output to allow an `implements` clause to be included when generating TypeScript.

```c
#pragma language(typescript)
#pragma extends(CustomDataView implements MyInterface)
struct FirstExample {
   ...
};
```

generates the following:

```js
class FirstExample extends CustomDataView implements MyInterface {
   ...
}
```


#### `export`
The `export` pragma determines whether the classes generated by CompileDataView are exported. The default is `true` which means the classes are exported. This pragma is useful when the generated code will be included in a module for use by other modules.

```js
export class CompiledDataView extends DataView {
...
```

#### `get` and `set`
The `get` and `set` pragmas control whether the generated class contains getters and/or setters for the defined properties. Both default to `true` which causes both getters and setters to be generated.

Excluding getters or setters generates less code and has no performance impact. This is useful when you know a particular data structure is only used for reading or writing.

#### `endian`
The `endian` pragma controls how multi-byte numeric values are stored. The default is `"host"` which will match the host endianness at runtime.  Other options are "little" for little-endian order and `"big"` for big-endian. Views that are used to only reduce the memory required for properties should not change the `endian` pragma from the default as native machine order is the most efficient.

The numeric types that `endian` effects are `Float32`, `Float64`, `Int32`, `Uint16`, `Uint32`, `BigInt64`, and `BigUint64`. The `endian` pragma also controls the endianness of multi-byte integers that store bitfields.

#### `pack`
The `pack` pragma controls the alignment of multi-byte numeric values. The default is `16` which causes values to be aligned based on the size the fields they contain. The default is generally compatible with C and safe for all JavaScript operations. Supported values are `1`, `2`, `4`, `8`, and `16`. Passing no argument for pack (`#pragma pack()`) restores the default.

Views that are used only to reduce the memory required for properties may use the default value of `1` which packs the fields as tightly as possible.

To see how pack works, consider the following data view description:

```c
#pragma pack(1)
#pragma get(false)

struct Pack {
	Uint8 a;
	Uint16 b;
	Uint8 c;
	Uint32 d;
};
```

The code generated uses eight bytes to store the properties:

```js
export class Pack extends DataView {
   constructor(data, offset) {
      if (data)
         super(data, offset ?? 0, 8);
       else
         super(new ArrayBuffer(8));
   }
   set a(value) {
      this.setUint8(0, value);
   }
   set b(value) {
      this.setUint16(1, value, true);
   }
   set c(value) {
      this.setUint8(3, value);
   }
   set d(value) {
      this.setUint32(4, value, true);
   }
}
```

If the `pack` pragma is changed to `4`, the data structure uses twelve bytes of memory.

```js
export class Pack extends DataView {
   constructor(data, offset) {
      if (data)
         super(data, offset ?? 0, 12);
       else
         super(new ArrayBuffer(12));
   }
   set a(value) {
      this.setUint8(0, value);
   }
   set b(value) {
      this.setUint16(2, value, true);
   }
   set c(value) {
      this.setUint8(4, value);
   }
   set d(value) {
      this.setUint32(8, value, true);
   }
}
```

Note that TypedArrays in JavaScript must be aligned to `byteOffset` values that are an integer multiple of their size. Changing `pack` to a value other than the default may result in data structures that generate runtime exceptions. For example, the following declaration puts the `data` Uint32 TypedArray at offset 1.

```c
#pragma pack(1)
struct Misaligned {
	char c;
	uint32_t data[4];
};
```

When accessed as follows, an exception is generated because the Uint32 TypedArray must be at a `byteOffset` that is a multiple of 4.

```js
let f = new Misaligned;
f.data[1] = 3;
```

#### `language`
The `language` property controls the language that the generated code is targeting.  The languages are currently supported are `javascript` and `typescript`.  Each of these optionally accept a platform of `xs`, `node` and `web`, with the default being `xs`.  The syntax is:

`<language>{/<platform>}`

For example, to use JavaScript on XS, use `javascript` or `javascript/xs` (which is the default).  To target TypeScript for Node, use `typescript/node`.

The differences are small between the platforms:
* `xs` (default): Uses `String.fromArrayBuffer` and `ArrayBuffer.fromString` for string to/from buffers (replaces `#pragma xs(true)`).
* `web`: Uses `TextEncoder` and `TextDecoder` for string to/from buffers (replaces `#pragma xs(false)`).
* `node`: Same as `web`, except also provides the required imports `import { TextEncoder, TextDecoder } from "util" };`.

#### `outputByteLength`
The `outputByteLength` pragma controls whether CompileDataView includes a static `byteLength` property in the generated class with the number of bytes used by the native data structure. Defaults to `false`.

#### `checkByteLength`
The `checkByteLength ` pragma controls whether CompileDataView generates code to confirm that an ArrayBuffer passed to a view constructor is at least as big as the view. Defaults to `true` so the length is checked. Setting this value to `false` is useful for variable views that end with a union. Note that even if the length is not checked, JavaScript guarantees you cannot read or write beyond the end of allocated memory.

#### `json`
The `json` property controls whether CompileDataView generates code for JSON serialization and object initialization. This experimental feature defaults to `false`.  

With `json` enabled, you can serialize binary views to JSON, even those with nested views. CompileDataView implements this by adding `toJSON` methods to the generated view classes. 

```js
let i = new IntroView;
i.a = 12;
i.c = "!";
i.data = [1, 1, 1, 1];
let json = JSON.stringify(i);
```

With `json` enabled, you use JavaScript objects to initialize binary data views using the static `from` method.

```js
let i = IntroView.from({
	a: 12,
	c: "!",
	data: [1, 1, 1, 1]
});
```

> **Note**: The `json` feature generates more code, so only enable it if you intend to use the capabilities it provides.
> 
> **Note**: The initialization support works with unions, but serialization does not support unions. 

#### `bitfields`
The `bitfields ` pragma controls whether bitfields are stored in the least or most significant unused bits. The default is `"lsb"` to store bitfields in the least significant unused bits. To store bitfields in the most significant unused bits instead, use `"msb"`. 

#### `comments`
The `comments` pragma controls how block (`/* ... */`) comments are injected into the output.  Options are `false` (no comments), `header` (default; include only the header block comment, which must start on the first line of the file) and `true` (include all block comments).  Line comments (`// ...`) are never injected.  This can be changed throughout the file. 

#### `import`
The `import` pragma injects an import for pulling in modules and TypeScript type definitions.  The parameter specifies the body of the import statement.  Multiple imports can be specified by using the pragma multiple times.  For example,

```c
#pragma import("./MyInterface")
#pragma import({ myMethod } from "./MyClass")
```

will generate:

```js
import "./MyInterface";
import { myMethod } from "./MyClass";
```

Imports may be placed anywhere in the content, but will always be injected at the top of the file (after the first comment if provided).

<a id="if-else-endif"></a>
## Conditional Compilation
CompileDataView implements a subset of the C preprocessor `#if`, `#else` and `#endif` directives. These are supported primarily to allow a header file to be safely shared between C compilers and CompileDataView. A typical use is to conditionalize `#pragma` directives unique to CompileDataView:

```
#if defined(__COMPILEDATAVIEW__)
   #pragma language(typescript)
#endif
```

`__COMPILEDATAVIEW__` is defined to be a positive integer containing the version number of CompileDataView.

```
#if __COMPILEDATAVIEW__ > 0
   #pragma json(true)
#endif
```

Nested `#if` directives are supported.

<a id="past-future"></a>
## Past and future
I have used this technique of extending `DataView` with getters and setters in several projects. Each time I wrote the getters and setters by hand. It isn't very difficult to do, though bitfields are a bit tedious and making changes to the data structures requires time-consuming renumbering of offsets. I wrote about this technique in the "JavaScript For Embedded C and C++ Programmers" chapter in the book "[IoT Development for ESP32 and ESP8266 with JavaScript](https://moddable.com/book)" (pages 116 to 118) together with Lizzie Prader.

CompileDataView is a weekend project to automate the technique. It applies approaches that worked well in the hand-rolled efforts.

There are some other libraries with a similar goal of simplifying access to native data structures with JavaScript's `DataView`. To use these libraries, if I recall correctly, the developer writes JavaScript to define the data structures. Those are then used to generate JavaScript classes at runtime. That makes good sense in the browser and Node.js, but is impractical on embedded systems. The approach CompileDataView takes offloads the code generation from the embedded device. I also like the idea of using a C-like syntax to define the data structures since many developers working on embedded systems have a background in C.

As a quick project, CompileDataView is a little rough. I know little about writing parsers and less about building web pages. The parser is adequate, but the [web page](https://phoddie.github.io/compileDataView/) could really use some help (hint, hint).

While CompileDataView is useful today, there are areas that could be explored further.
 
- **ASCII strings**: The `string` type stores UTF-8 which is useful, but 8-bit character data is common enough in many binary formats that it makes sense to support directly.
- **Date**: It might be useful to allow `Date` objects to be stored directly, as Booleans are.
- **Code generation**: The code for copying structures and strings could be optimized based on the size of the copy.

<a id="acknowledgements"></a>
## Acknowledgements
The motivation for creating CompileDataView was code kindly shared in the [Embedded JavaScript Gitter](https://gitter.im/embedded-javascript/moddable) by an embedded developer ([@SkyeSweeney](https://github.com/SkyeSweeney)) writing their first JavaScript code.

Support for TypeScript output was contributed by [Chris Midgley](https://github.com/cmidgley).

The original syntax of the binary data descriptions was unnecessarily complex. Thanks to Patrick Soquet for encouraging me to follow the C model more closely.

<a id="contact"></a>
## Contact
If you run into an issue or have question, please post it to the [CompileDataView repository](https://github.com/phoddie/compileDataView). You can also reach me on Twitter at [@phoddie](https://twitter.com/phoddie). Pull requests with improvements are welcome.
