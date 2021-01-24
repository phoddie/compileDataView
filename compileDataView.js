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

		- could use (and cache( Uint8Array view of this.buffer for faster strings
		- "xs" setting -- when false, don't use String.fromArrayBuffer and ArrayBuffer.fromString
		- bitfields that align to byte and are a multiple of 8 special case
		- "align" setting - control alignment of 2 and 4 byte fields

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
let names;
let bitfields;
let byteOffset;
let lineNumber;
let littleEndian;
let doSet;
let doGet;

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
			output.push(`      const t = this.get${type}(${byteOffset}${endian}) & ${toHex(~(mask << bitOffset), byteCount)};`);
			if (bitfield.boolean)
				output.push(`      this.set${type}(${byteOffset}, t | (value ? ${toHex(1 << bitOffset)} : 0)${endian});`);
			else
				output.push(`      this.set${type}(${byteOffset}, t | ((value & ${toHex(mask, byteCount)})${shiftLeft})${endian});`);
			output.push(`   }`);
		}

		bitOffset += bitfield.bitCount;
	}

	bitfields.length = 0;
	byteOffset += byteCount;
}

function compileDataView(input) {
	className = "Data";
	output = [];
	names = [];
	bitfields = [];
	byteOffset = 0;
	lineNumber = 1;
	littleEndian = true;
	doSet = true;
	doGet = true;

	const errors = [];

	for (const lines = input.split("\n"); lines.length; lineNumber += 1) {
		try {
			let bitCount, byteCount, arrayCount;
			let line = lines.shift().trimStart();
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
					throw new Error(`semicolon expected at line ${lineNumber}`);
				const value = line.slice(colon + 1, semicolon).trimStart().trimEnd();
				switch (setting) {
					case "class":
						className = value;
						break;

					case "endian":
						if ("little" == value)
							littleEndian = true;
						else if ("big" == value)
							littleEndian = false;
						else
							throw new Error(`invalid endian "${value}" specified at line ${lineNumber}`);
						break;

					case "set":
						if ("true" == value)
							doSet = true;
						else if ("false" == value)
							doSet = false;
						else
							throw new Error(`invalid set "${value}" specified at line ${lineNumber}`);
						break;

					case "get":
						if ("true" == value)
							doGet = true;
						else if ("false" == value)
							doGet = false;
						else
							throw new Error(`invalid get "${value}" specified at line ${lineNumber}`);
						break;

					default:
						throw new Error(`unknow setting "${setting}" at line ${lineNumber}`);
						break;
				}
				continue;
			}

			if (space < 0)
				throw new Error(`space expected at line ${lineNumber}`);
			const type = line.slice(0, space);
			line = line.slice(space).trimStart();

			let semicolon = line.indexOf(";");
			if (semicolon < 0)
				throw new Error(`semicolon expected at line ${lineNumber}`);
			let name = line.slice(0, semicolon);

			colon = name.indexOf(":");
			if (colon > 0) {
				bitCount = parseInt(name.slice(colon + 1));
				if ((bitCount <= 0) || (bitCount > 32) || isNaN(bitCount))
					throw new Error(`invalid bit count at line ${lineNumber}`);
				name = name.slice(0, colon);
			}
			else {
				let leftBrace = name.indexOf("[");
				if (leftBrace >= 0) {
					let rightBrace = name.indexOf("]");
					if (rightBrace < 0)
						throw new Error(`right brace expected at line ${lineNumber}`);
					arrayCount = parseInt(name.slice(leftBrace + 1, rightBrace));
					if ((arrayCount <= 0) || isNaN(arrayCount))
						throw new Error(`invalid array count at line ${lineNumber}`);
					name = name.slice(0, leftBrace);
				}
			}

			if (names.includes(name))
				throw new Error(`duplicate name "${name}" at line ${lineNumber}`);
			names.push(name);

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
						throw new Error(`cannot use bitfield with type "${type}" at line ${lineNumber}`);

					const byteCount = byteCounts[type];

					if (doGet) {
						output.push(`   get ${name}() {`);
						if (undefined === arrayCount) {
							if (1 === byteCount)
								output.push(`      return this.get${type}(${byteOffset});`);
							else
								output.push(`      return this.get${type}(${byteOffset}, ${littleEndian});`);
						}
						else {
							output.push(`      return new ${type}Array(this.buffer.slice(${byteOffset}, ${byteOffset + (arrayCount * byteCount)}));`);
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
						throw new Error(`char cannot use bitfield at line ${lineNumber}`);

					if (doGet) {
						output.push(`   get ${name}() {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return String.fromCharCode(this.getUint8(${byteOffset}));`);
						else
							output.push(`      return String.fromArrayBuffer(this.buffer.slice(${byteOffset}, ${byteOffset + arrayCount}));`);
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return this.setUint8(${byteOffset}, value.charCodeAt());`);
						else {
							output.push(`      value = new Uint8Array(ArrayBuffer.fromString(value));`);
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
						throw new Error(`number of bits in bitfield missing at line ${lineNumber}`);

					flushBitfields(bitCount);

					bitfields.push({
						name,
						bitCount
					});
					break;

				case "Boolean":
					flushBitfields(1);
					if (undefined !== arrayCount)
						throw new Error(`Boolean cannot have array at line ${lineNumber}`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with type "${type}" at line ${lineNumber}`);

					bitfields.push({
						name,
						bitCount: 1,
						boolean: true
					});
					break;

				default:
					throw new Error(`unknown type "${type}" at line ${lineNumber}`);
			}
		}
		catch (e) {
			errors.push(e.toString());
		}
	}
	flushBitfields();
	output.push(`}`);
	output.push(``);
	output.push(`// auto-generated by compileDataView.js on ${new Date}`);

	const start = [];
	start.push(`class ${className} extends DataView {`);
	start.push(`   constructor(data, offset) {`);
	start.push(`      if (data)`);
	start.push(`         super(data, offset ?? 0, ${byteOffset});`);
	start.push(`       else`);
	start.push(`         super(new ArrayBuffer(${byteOffset}));`);
	start.push(`   }`);

	if (errors.length) {
		errors.unshift("*****")
		errors.push("*****")
		errors.push("")
	}

	return errors.concat(start, output).join("\n");
}
globalThis.compileDataView = compileDataView;

export default {};
