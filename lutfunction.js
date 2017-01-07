"use strict";
// Mapping from lut function (0..0xffff) to textual description.
var lutFunctions = [];


var lutInputs = ['A', 'B', 'C', 'D'];
// Small table, mapping a 4-bit value of lut inputs that are driven,
// to the count of driven inputs, 0..4.
var lut_inputs_drive2count;


function lutNumDriven(drivenLuts) {
    if (!lut_inputs_drive2count) {
	var table = new Uint8Array(16);
	for (var a = 0; a <= 1; ++a)
	    for (var b = 0; b <= 1; ++b)
		for (var c = 0; c <= 1; ++c)
		    for (var d = 0; d <= 1; ++d)
			table[a|(b<<1)|(c<<2)|(d<<3)] = a+b+c+d;
	lut_inputs_drive2count = table;
    }
    return lut_inputs_drive2count[drivenLuts];
}


// Evaluate a lut truth table at given inputs.
// The lut truth-table is big-endian, so input 0b0000 is bit 15,
// 0b0001 is bit 14, ... 0b1111 is bit 0.
function lutEvaluate(lut, inputs) {
    if (lut & (1 << (15 - inputs)))
	return 1;
    else
	return 0;
}


// Normalise the lut truth table, eliminating not driven inputs.
// So when eg. only two inputs are driven, the normalised truth table
// has 4 bits, to hold the combinations for 00, 01, 10, and 11.
function lutNormalise(lut, driven) {
    var numDriven = lutNumDriven(driven);
    var normSize = 1<<numDriven;
    var normLut = 0;
    // The normalised lut function is obtained by taking not driven inputs
    // as zero and combining with driven inputs to lookup in the original
    // truth table.
    for (var normInputVals = 0; normInputVals < normSize; ++normInputVals) {
	var fullInputVals = 0;
	var tmp = normInputVals;
	for (var j = 0; j < 4; ++j) {
	    if (driven & (1<<j)) {
		fullInputVals |= (tmp&1) << j;
		tmp >>= 1;
	    }
	}
	normLut = (normLut << 1) | lutEvaluate(lut, fullInputVals);
    }
    return normLut;
}


// Default/fallback: Just the 2**N-bit representation, eg. 1001011010010110.
function calcFallbackLutFunction(n) {
    var truthTableSize = (1<<(1<<n));
    var lut = new Array(truthTableSize);
    lut[0] = "0";
    for (var i = 1; i < truthTableSize-1 ; ++i) {
	// Prefix with leading zeros.
	var tmp = i + truthTableSize;
	lut[i] = tmp.toString(2).substr(1);
    }
    lut[i] = "1";
    return lut;
}


// Populate the lut pretty-print table with the default representation, which
// is just a bitstring of the values in the truth table.
function defaultLutFunctionPopulate() {
    for (var numDriven = 0; numDriven <= 4; ++numDriven) {
	var prettyTable = calcFallbackLutFunction(numDriven);
	var needCopy = false;
	for (var driven = 0; driven < 16; ++driven) {
	    if (lutNumDriven(driven) == numDriven) {
		if (needCopy)
		    lutFunctions[driven] = prettyTable.slice(0);
		else {
		    lutFunctions[driven] = prettyTable;
		    needCopy = true;
		}
	    }
	}
    }
}


function calcLut0(name, fn) {
    var v = fn() & 1;
    lutFunctions[0b0000][v] = name;
}


function calcLut1(fn) {
    var v = ((fn(0) & 1) << 1) | (fn(1) & 1);
    return v;
}


function calcLut2(fn) {
    var v = 0;
    for (var b = 0; b <= 1; ++b)
	for (var a = 0; a <= 1; ++a)
	    v = (v << 1) | (fn(a, b) & 1);
    return v;
}


function calcLut3(fn) {
    var v = 0;
    for (var c = 0; c <= 1; ++c)
	for (var b = 0; b <= 1; ++b)
	    for (var a = 0; a <= 1; ++a)
		v = (v << 1) | (fn(a, b, c) & 1);
    return v;
}


function calcLut4(name, fn) {
    var v = 0;
    for (var d = 0; d <= 1; ++d) {
	for (var c = 0; c <= 1; ++c) {
	    for (var b = 0; b <= 1; ++b) {
		for (var a = 0; a <= 1; ++a) {
		    v = (v << 1) | (fn(a, b, c, d) & 1);
		}
	    }
	}
    }
    lutFunctions[0b1111][v] = name;
}


function lutPopulateAdd() {
    calcLut4("A+B+C+D", function(a, b, c, d) { return (a+b+c+d); });
    calcLut4("~(A+B+C+D)", function(a, b, c, d) { return ~(a+b+c+d); });
    // ToDo: Better way for 2 or 3 inputs driven.
    var add2Lut = calcLut2(function(a, b) { return (a+b); });
    lutFunctions[0b0011][add2Lut] = "A+B";
    lutFunctions[0b0101][add2Lut] = "A+C";
    lutFunctions[0b1001][add2Lut] = "A+D";
    lutFunctions[0b0110][add2Lut] = "B+C";
    lutFunctions[0b1010][add2Lut] = "B+D";
    lutFunctions[0b1100][add2Lut] = "C+D";
    var add3Lut = calcLut3(function(a, b, c) { return (a+b+c); });
    lutFunctions[0b0111][add3Lut] = "A+B+C";
    lutFunctions[0b1011][add3Lut] = "A+B+D";
    lutFunctions[0b1101][add3Lut] = "A+C+D";
    lutFunctions[0b1110][add3Lut] = "B+C+D";
}


function lutPopulateNeg() {
    var neg1Lut = calcLut1(function(a) { return ~a; });
    lutFunctions[0b0001][neg1Lut] = "~A";
    lutFunctions[0b0010][neg1Lut] = "~B";
    lutFunctions[0b0100][neg1Lut] = "~C";
    lutFunctions[0b1000][neg1Lut] = "~D";
    var copy1Lut = calcLut1(function(a) { return a; });
    lutFunctions[0b0001][copy1Lut] = "A";
    lutFunctions[0b0010][copy1Lut] = "B";
    lutFunctions[0b0100][copy1Lut] = "C";
    lutFunctions[0b1000][copy1Lut] = "D";
}


function lutFunctionPopulate() {
    // Listed in order of increasing priority, so that more useful names
    // override earlier, less useful.
    defaultLutFunctionPopulate();

    lutPopulateAdd();
    lutPopulateNeg()
}


function getLutTextFunction(lut, driven) {
    return lutFunctions[driven][lutNormalise(lut, driven)];
}

lutFunctionPopulate();
