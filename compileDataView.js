/*
* Copyright (c) 2021  Moddable Tech, Inc.
*
*   This file is part of the Moddable SDK Tools.
*
*   The Moddable SDK Tools is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License as published by
*   the Free Software Foundation, either version 3 of the License, or
*   (at your option) any later version.
*
*   The Moddable SDK Tools is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with the Moddable SDK Tools.  If not, see <http://www.gnu.org/licenses/>.
*/

/*

	to do:

		- bitfields that align to byte and are a multiple of 8 in size special case
		- faster generated code for set of embedded views
		- initializers

*/

const byteCounts = {
	Int8: 1,
	Int16: 2,
	Int32: 4,
	Uint8: 1,
	Uint16: 2,
	Uint32: 4,
	Float32: 4,
	Float64: 8,
	BigInt64: 8,
	BigUint64: 8
};

let className;
let output;
let classes;
let properties;
let bitfields;
let byteOffset;
let lineNumber;
let littleEndian;
let doSet;
let doGet;
let doExport;
let pack;
let extendsClass;
let xs;
let byteLength;

const hex = "0123456789ABCDEF";
function toHex(value, byteCount = 4) {
	let result = "";
	let nybbles = byteCount * 2;
	while (value && nybbles--) {
		result = hex[value & 15] + result;
		value = (value & 0xFFFFFFF0) >>> 4;
	}
	return "0x" + (("" === result) ? "0" : result);
}

function booleanSetting(value, name) {
	if ("true" === value)
		return true;

	if ("false" === value)
		return false;

	throw new Error(`invalid ${name} "${value}" specified`);
}

function flushBitfields(bitsToAdd = 32) {
	let total = 0, type, endian, byteCount;

	for (let i = 0; i < bitfields.length; i++)
		total += bitfields[i].bitCount;

	if ((0 == total) || ((total + bitsToAdd) < 32))
		return;

	if (total <= 8) {
		type = "Uint8";
		byteCount = 1;
		endian = "";
	}
	else {
		type = (total <= 16) ? "Uint16" : "Uint32";
		byteCount = (total <= 16) ? 2 : 4;
		endian = ", true";
	}

	let bitOffset = 0;
	while (bitfields.length) {
		const bitfield = bitfields.shift();
		const mask = (2 ** bitfield.bitCount) - 1;
		const shiftLeft = bitOffset ? " << " + bitOffset : "";
		const shiftRight = bitOffset ? " >> " + bitOffset : "";

		if (doGet) {
			output.push(`   get ${bitfield.name}() {`);
			if (bitfield.boolean)
				output.push(`      return Boolean(this.get${type}(${byteOffset}${endian}) & ${toHex(mask << bitOffset, byteCount)});`);
			else
				output.push(`      return (this.get${type}(${byteOffset}${endian})${shiftRight}) & ${toHex(mask, byteCount)};`);
			output.push(`   }`);
		}

		if (doSet) {
			output.push(`   set ${bitfield.name}(value) {`);
			if (bitfield.boolean) {
				output.push(`      const t = this.get${type}(${byteOffset}${endian});`);
				output.push(`      this.set${type}(${byteOffset}, value ? (t | ${toHex(1 << bitOffset)}) : (t & ${toHex(~(mask << bitOffset), byteCount)})${endian});`);
			}
			else if (1 === bitfield.bitCount) {
				output.push(`      const t = this.get${type}(${byteOffset}${endian});`);
				output.push(`      this.set${type}(${byteOffset}, (value & 1) ? (t | ${toHex(1 << bitOffset)}) : (t & ${toHex(~(mask << bitOffset), byteCount)})${endian});`);
			}
			else {
				output.push(`      const t = this.get${type}(${byteOffset}${endian}) & ${toHex(~(mask << bitOffset), byteCount)};`);
				output.push(`      this.set${type}(${byteOffset}, t | ((value & ${toHex(mask, byteCount)})${shiftLeft})${endian});`);
			}
			output.push(`   }`);
		}

		bitOffset += bitfield.bitCount;
	}

	bitfields.length = 0;
	byteOffset += byteCount;
}

function compileDataView(input) {
	className = "CompiledDataView";
	output = [];
	properties = [];
	classes = {};
	bitfields = [];
	byteOffset = 0;
	lineNumber = 1;
	littleEndian = true;
	doSet = true;
	doGet = true;
	doExport = true;
	pack = true;
	extendsClass = "DataView";
	xs = true;
	byteLength = false;

	let final = [];
	const errors = [];

	const lines = input.split("\n");
	lines.push("EOF: 0;");

	for (; lines.length; lineNumber += 1) {
		const originalLine = lines.shift().trimStart().trimEnd();

		try {
			let bitCount, byteCount, arrayCount;
			let line = originalLine;
			if (!line)
				continue;

			if (line.startsWith("//"))
				continue;

			let colon = line.indexOf(":");
			let space = line.indexOf(" ");

			if ((colon > 0) && (colon < space)) {
				const setting = line.slice(0, colon);
				const semicolon = line.indexOf(";", colon);
				if (semicolon < 0)
					throw new Error(`semicolon expected`);
				let value = line.slice(colon + 1, semicolon).trimStart().trimEnd();
				switch (setting) {
					case "class":
					case "EOF":
						flushBitfields();
						if (byteOffset) {
							output.push(`}`);
							output.push(``);

							const start = [];
							start.push(`${doExport ? "export " : ""}class ${className} extends ${extendsClass} {`);
							if (byteLength) {
								start.push(`   static byteLength = ${byteOffset};`);
								start.push(``);
							}
							start.push(`   constructor(data, offset) {`);
							start.push(`      if (data)`);
							start.push(`         super(data, offset ?? 0, ${byteOffset});`);
							start.push(`       else`);
							start.push(`         super(new ArrayBuffer(${byteOffset}));`);
							start.push(`   }`);

							final = final.concat(start, output);

							classes[className] = {
								byteLength: byteOffset
							};

							output.length = 0;
							byteOffset = 0;
							properties.length = 0;
						}

						className = value;
						if (classes[className])
							throw new Error(`duplicate class "${className}"`);
						break;

					case "extends":
						extendsClass = value;
						break;

					case "endian":
						if ("little" == value)
							littleEndian = true;
						else if ("big" == value)
							littleEndian = false;
						else
							throw new Error(`invalid endian "${value}" specified`);
						break;

					case "pack":
						pack = booleanSetting(value, setting);
						break;

					case "xs":
						xs = booleanSetting(value, setting);
						break;

					case "set":
						doSet = booleanSetting(value, setting);
						break;

					case "get":
						doGet = booleanSetting(value, setting);
						break;

					case "export":
						doExport = booleanSetting(value, setting);
						break;

					case "byteLength":
						byteLength = booleanSetting(value, setting);
						break;

					default:
						throw new Error(`unknown setting "${setting}"`);
						break;
				}
				continue;
			}

			if (space < 0)
				throw new Error(`space expected`);
			const type = line.slice(0, space);
			line = line.slice(space).trimStart();

			let semicolon = line.indexOf(";");
			if (semicolon < 0)
				throw new Error(`semicolon expected`);
			let name = line.slice(0, semicolon);

			colon = name.indexOf(":");
			if (colon > 0) {
				bitCount = parseInt(name.slice(colon + 1));
				if ((bitCount <= 0) || (bitCount > 32) || isNaN(bitCount))
					throw new Error(`invalid bit count`);
				name = name.slice(0, colon);
			}
			else {
				let leftBrace = name.indexOf("[");
				if (leftBrace >= 0) {
					let rightBrace = name.indexOf("]");
					if (rightBrace < 0)
						throw new Error(`right brace expected`);
					arrayCount = parseInt(name.slice(leftBrace + 1, rightBrace));
					if ((arrayCount <= 0) || isNaN(arrayCount))
						throw new Error(`invalid array count`);
					name = name.slice(0, leftBrace);
				}
			}

			if (properties.includes(name))
				throw new Error(`duplicate name "${name}"`);
			properties.push(name);

			switch (type) {
				case "Float32":
				case "Float64":
				case "Int8":
				case "Int16":
				case "Int32":
				case "Uint8":
				case "Uint16":
				case "Uint32":
				case "BigInt64":
				case "BigUint64":
					flushBitfields();
					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					const byteCount = byteCounts[type];

					if (!pack && (byteOffset % byteCount))
						byteOffset += byteCount - (byteOffset % byteCount);

					if (doGet) {
						output.push(`   get ${name}() {`);
						if (undefined === arrayCount) {
							if (1 === byteCount)
								output.push(`      return this.get${type}(${byteOffset});`);
							else
								output.push(`      return this.get${type}(${byteOffset}, ${littleEndian});`);
						}
						else {
							output.push(`      return new ${type}Array(this.buffer, this.byteOffset${byteOffset ? (" + " + byteOffset) : ""}, ${arrayCount * byteCount});`);
						}
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						if (undefined === arrayCount) {
							if (1 === byteCount)
								output.push(`      this.set${type}(${byteOffset}, value);`);
							else
								output.push(`      this.set${type}(${byteOffset}, value, ${littleEndian});`);
						}
						else {
							output.push(`      for (let i = 0, j = ${byteOffset}; i < ${arrayCount}; i++, j += ${byteCount})`);
							output.push(`         this.set${type}(j, value[i]);`);
						}

						output.push(`   }`);
					}

					byteOffset += (arrayCount ?? 1) * byteCount;
					break;

				case "char":
					flushBitfields();

					if (undefined !== bitCount)
						throw new Error(`char cannot use bitfield`);

					if (doGet) {
						output.push(`   get ${name}() {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return String.fromCharCode(this.getUint8(${byteOffset}));`);
						else {
							if (xs)
								output.push(`      return String.fromArrayBuffer(this.buffer.slice(${byteOffset}, ${byteOffset + arrayCount}));`);
							else
								output.push(`      return TextDecoder().decode(this.buffer.slice(${byteOffset}, ${byteOffset + arrayCount}));`);
						}
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return this.setUint8(${byteOffset}, value.charCodeAt());`);
						else {
							if (xs)
								output.push(`      value = new Uint8Array(ArrayBuffer.fromString(value));`);
							else
								output.push(`      value = new TextEncoder().encode(value);`);
							output.push(`      const byteLength = value.byteLength;`);
							output.push(`      if (byteLength > ${arrayCount})`);
							output.push(`         throw new Error("too long");`);
							output.push(`      for (let i = 0; i < byteLength; i++)`);
							output.push(`         this.setUint8(${byteOffset} + i, value[i]);`);
							output.push(`      for (let i = byteLength; i < ${arrayCount}; i++)`);
							output.push(`         this.setUint8(${byteOffset} + i, 0);`);
						}
						output.push(`   }`);
					}

					byteOffset += arrayCount ?? 1;
					break;

				case "Uint":
					if (undefined === bitCount)
						throw new Error(`number of bits in bitfield missing`);

					flushBitfields(bitCount);

					bitfields.push({
						name,
						bitCount
					});
					break;

				case "Boolean":
					flushBitfields(1);

					if (undefined !== arrayCount)
						throw new Error(`Boolean cannot have array`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					bitfields.push({
						name,
						bitCount: 1,
						boolean: true
					});
					break;

				default:
					if (!classes[type])
						throw new Error(`unknown type "${type}"`);

					flushBitfields();

					if (undefined !== arrayCount)
						throw new Error(`${type} cannot have array`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					if (doGet) {
						output.push(`   get ${name}() {`);
							output.push(`      return new ${type}(this.buffer, this.byteOffset${byteOffset ? (" + " + byteOffset) : ""}, ${classes[type].byteLength});`);
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						output.push(`      for (let i = 0; i < ${classes[type].byteLength}; i++)`);
						output.push(`         this.setUint8(i + ${byteOffset}, value.getUint8(i));`);
						output.push(`   }`);
					}

					byteOffset += classes[type].byteLength;
					break;
			}
		}
		catch (e) {
			errors.push(`   ${e}, line ${lineNumber}: ${originalLine}`);
		}
	}

	final.push("/*");
	final.push("");
	final.push(`View classes generated by https://phoddie.github.io/compileDataView on ${new Date} from the following description:`);
	final.push("");
	final.push(input);
	final.push("*/");

	if (errors.length) {
		errors.unshift("/*")
		errors.push("*/")
		errors.push("")
	}

	return {
		script: final.join("\n"),
		errors: errors.join("\n")
	}
}
globalThis.compileDataView = compileDataView;

export default {};
