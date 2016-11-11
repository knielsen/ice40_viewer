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


function chipdb_parse_step(parser, chipdb, onComplete) {
    var i;

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
    switch(typ) {
    case "device":
	args = [".device", "width", "height", "num_nets"];
	break;
    case "pins":
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
	break;
    case "logic_tile":
	break;
    case "ramb_tile":
	break;
    case "ramt_tile":
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

    var typdata = { };
    chipdb[typ] = typdata;

    if (args.length) {
	if (end >= line.length)
	    throw "No arguments on type '" + typ + "'";
	var strargs = line.substring(end + 1, line.length).split(" ");
	var i;
	for (i = 0; i < args.length; ++i) {
	    if (i >= strargs.length)
		throw "Missing argument " + i + " for typ '" + typ + "'"
	    var a = strargs[i];
	    var n = args[i];
	    if (n.substr(0,1) == ".")
		n = n.substring(1, n.length);
	    else
		a = parseInt(a);
	    typdata[n] = a;
	}
    }

    for (;;) {
	line = nextLine(parser);
	if (line == null) {
	    return onComplete(chipdb);
	}
	if (line == "")
	    break;
	// ToDoL: Process the line ...
    }
    }

    // Yield for other tasks before processing the next chunk...
    setTimeout(function () { chipdb_parse_step(parser, chipdb, onComplete); }, 0);
}
