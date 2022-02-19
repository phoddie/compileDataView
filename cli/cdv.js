/*
* Copyright (c) 2021-2022  Moddable Tech, Inc.
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

import * as fs from "fs";
import path from "path";
import process from "process";
import "../compileDataView.js";

if (process.argv.length < 3 || process.argv.length > 4) {
    console.log("CompileDataView CLI");
    console.log("CDV <cdv-file> {<js-or-ts-file>}");
    process.exit(2);
}

const sourcePath = process.argv[2];

const sourceContents = fs.readFileSync(sourcePath, { encoding: 'utf-8' });

const compileResults = compileDataView(sourceContents);
if (compileResults.errors) {
    console.log(`Errors during compilation:\n${compileResults.errors}`);
    compileResults.script = compileResults.errors.concat(compileResults.script);
}

const targetPath = (process.argv.length > 3) ? process.argv[3] : path.format({ ...path.parse(sourcePath), base: '', ext: `.${compileResults.language}` });
fs.writeFileSync(targetPath, compileResults.script, { encoding: 'utf-8' });

process.exit(compileResults.errors ? 1 : 0);

