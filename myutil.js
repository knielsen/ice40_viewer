function getLineParser(s) {
    var parser = { str: s, pos: 0 };
    return parser;
}


function nextLine(parser) {
    var oldpos = parser.pos;
    var str = parser.str;
    if (oldpos >= str.length)
	return null;
    var newpos = str.indexOf("\n", oldpos);
    if (newpos < 0)
	newpos = str.length;
    var line = str.substring(oldpos, newpos);
    if (newpos < str.length)
	++newpos;
    parser.pos = newpos;
    return line;
}


function nextNonBlankLine(parser) {
    for (;;) {
	var line = nextLine(parser);
	if (line == null)
	    return null;
	if (line.length == 0)
	    continue;
	if (line.substr(0, 1) == "#")
	    continue;
	return line;
    }
}


function unNextLine(parser, line) {
    var del = line.length + 1;
    if (del > parser.pos)
	throw "Attempt to unNextLine() past start of buffer";
    parser.pos -= del;
}


function chipdb_parse_step(parser, chipdb, onComplete) {
    var i;

    // Parse out arguments from .section header.
    var line_args = function(line, end, typ) {
	if (end >= line.length)
	    throw "No arguments on type '" + typ + "'";
	return line.substring(end + 1, line.length).split(" ");
    };

    // Singleton section. Just fields for each arg on the .TYPE line.
    var init_single_args = function(args_names) {
	return function (typ, line, end) {
	    var strargs = line_args(line, end, typ);
	    if (typ in chipdb)
		throw "Duplicate section '" + typ + "'";
	    var typdata = { };
	    var i;
	    for (i = 0; i < args_names.length; ++i) {
		if (i >= strargs.length)
		    throw "Missing argument " + i + " for typ '" + typ + "'"
		var a = strargs[i];
		var n = args_names[i];
		if (n.substr(0,1) == ".")
		    n = n.substring(1, n.length);
		else
		    a = parseInt(a);
		typdata[n] = a;
	    }
	    chipdb[typ] = typdata;
	    return typdata;
	};
    };

    // Single .section argument which becomes hash key containing nested hash.
    var init_hash_hash = function (typ, line, end) {
	var entry;
	if (typ in chipdb)
	    entry = chipdb[typ];
	else
	    chipdb[typ] = entry = { };
	var typdata = { };
	var strargs = line_args(line, end, typ);
	if (strargs.length != 1)
	    throw "Unexpected arguments for section '" + line + "'";
	entry[strargs[0]] = typdata;
	return typdata;
    }

    var tile_init = function(typ, line, end) {
	if (!(typ in chipdb))
	    chipdb[typ] = [];
	var arr = chipdb[typ];
	var args = line_args(line, end, typ);
	var x = parseInt(args[0]);
	var y = parseInt(args[1]);
	if (!(y in arr))
	    arr[y] = [];
	arr[y][x] = 1;
	return arr;
    };

    // Process a bunch of sections, then yield to avoid non-responsive GUI.
    // Need a fairly large number of sections at once, otherwise things become
    // really slow. The chipdb-8k.txt has 400k sections and 3M lines...
for (i = 0; i < 5000; ++i) {
    var line = nextNonBlankLine(parser);
    if (line == null) {
	return onComplete(chipdb);
    }

    if (line.substr(0, 1) != ".")
	throw ("Unexpected line: '" + line + "'.");
    var end = line.indexOf(" ", 1);
    if (end < 0)
	end = line.length;
    var typ = line.substring(1, end);
    var args = [];
    var init_func = function (typ, line, end) { };
    var content_func = function (data, cs, values) { };
    switch(typ) {
    case "device":
	init_func = init_single_args([".device", "width", "height", "num_nets"]);
	break;
    case "pins":
	init_func = init_hash_hash;
	content_func = function (typdata, values) {
	    var entry = { pin_num: values[0], tile_x: parseInt(values[1]),
			  tile_y: parseInt(values[2]), num_nets: parseInt(values[3]) };
	    typdata[values[0]] = entry;
	};
	break;
    case "gbufin":
	break;
    case "gbufpin":
	break;
    case "iolatch":
	break;
    case "ieren":
	break;
    case "colbuf":
	break;
    case "io_tile":
	init_func = tile_init;
	break;
    case "logic_tile":
	init_func = tile_init;
	break;
    case "ramb_tile":
	init_func = tile_init;
	break;
    case "ramt_tile":
	init_func = tile_init;
	break;
    case "io_tile_bits":
	break;
    case "logic_tile_bits":
	break;
    case "ramb_tile_bits":
	break;
    case "ramt_tile_bits":
	break;
    case "extra_cell":
	break;
    case "extra_bits":
	break;
    case "net":
	break;
    case "buffer":
	break;
    case "routing":
	break
    default:
	throw "Unknown type found: '" + typ + "'";
    }

    var typdata;
    if (init_func)
	typdata = init_func(typ, line, end);
    else
	typdata = null;

    for (;;) {
	line = nextLine(parser);
	if (line == null) {
	    return onComplete(chipdb);
	}
	if (line == "")
	    break;
	if (line.substring(0, 1) == ".") {
	    unNextLine(parser, line);
	    break;
	}	    
	var values = line.split(" ");
	content_func(typdata, values);
    }
}

    // Yield for other tasks before processing the next chunk...
    setTimeout(function () { chipdb_parse_step(parser, chipdb, onComplete); }, 0);
}
