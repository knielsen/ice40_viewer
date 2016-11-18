var routing_wire_kinds = ["sp12h", "sp12v", "sp4h", "sp4v", "fb", "glb", "iosp4"];
var routing_spanonly = ["sp12h", "sp12v", "sp4h", "sp4v", "iosp4"];


// Get a simple index to identify a span in a tile, for drawing.
// Spans on the left or top are numbered 0..47 (span4) or 0..23 (span12).
// Span4 36..47 and span12 22..23 terminate, and new wires originate at
// the right or bottom, these are indexed as 48..59 (span4) or 24..25
// (span12). This is a bit different from the name normalisation normally
// used in project icestorm.
// There are extra span4 connections towards the vertical span4 on the
// column of tiles to the right. These wires are indexed 60..107.
// For IO tiles, the connections to logic tiles have the corresponding
// indexes 0..47. The io-to-io span4s are numbered 0-19, where 0-15 are
// the wires along the top or left, and 16-19 are the wires that originate
// in the IO cell on the bottom or right.
function span_index(span_name) {
    var idx;

    if (span_name.substr(0, 8) == "sp4_h_r_" ||
	span_name.substr(0, 8) == "sp4_v_b_") {
	idx = parseInt(span_name.substr(8));
	idx = (idx < 12 ? idx + 48 : (idx ^ 1) - 12);
    } else if (span_name.substr(0, 9) == "sp12_h_r_" ||
	       span_name.substr(0, 9) == "sp12_v_b_") {
	idx = parseInt(span_name.substr(9));
	idx = (idx < 2 ? idx + 24 : (idx ^ 1) - 2);
    } else if (span_name.substr(0, 8) == "sp4_h_l_" ||
	       span_name.substr(0, 8) == "sp4_v_t_") {
	idx = parseInt(span_name.substr(8));
    } else if (span_name.substr(0, 9) == "sp12_h_l_" ||
	       span_name.substr(0, 9) == "sp12_v_t_") {
	idx = parseInt(span_name.substr(9));
    } else if (span_name.substr(0, 10) == "sp4_r_v_b_") {
	idx = parseInt(span_name.substr(10)) + 60;
	if (idx > 60+12)
	    idx ^= 1;
    } else if (span_name.substr(0, 13) == "span4_vert_t_" ||
	      span_name.substr(0, 13) == "span4_horz_l_") {
	idx = parseInt(span_name.substr(13));
    } else if (span_name.substr(0, 13) == "span4_vert_b_" ||
	      span_name.substr(0, 13) == "span4_horz_r_") {
	idx = parseInt(span_name.substr(13));
	idx = (idx < 4 ? idx + 16 : idx - 4);
    } else if (span_name.substr(0, 11) == "span4_horz_" ||
	       span_name.substr(0, 11) == "span4_vert_") {
	idx = parseInt(span_name.substr(11));
    } else if (span_name.substr(0, 12) == "span12_horz_" ||
	       span_name.substr(0, 12) == "span12_vert_") {
	idx = parseInt(span_name.substr(12));
    } else
	throw "Unable to convert net name '" + span_name + "' to in-tile span index";

    return idx;
}


function tile_net_initdata(kind, span_name) {
    var idx = span_index(span_name);
    return { kind: kind, index: idx };
}


function process_driven_net(net, kind, tile, x, y) {
    var netdata = tile.nets[net];
    if (routing_spanonly.indexOf(kind) >= 0) {
	var netnames = chipdb.nets[net].names;
	var first_active = -1;
	var last_active = -1;
	// Find the first and last tile within the active part of the net.
	// Let's utilise that net names are listed in tile order.
	for (var i = 0; i < netnames.length; ++i) {
	    var dbnet = netnames[i];
	    var x1 = dbnet.tile_x;
	    var y1 = dbnet.tile_y;
	    var active_idx = i;
	    if (x1 == x && y1 == y) {
		if (!(net in tile.nets))
		    tile.nets[net] = tile_net_initdata(kind, dbnet.name);
		// The extra connections to the left tiles of a vertical span4
		// are special. They are all at the "end" of the span, so will
		// not be marked active just because other parts are. But the
		// part of the span to the right, if any, _will_ need to me
		// marked active.
		if (dbnet.name.substr(0, 10) == "sp4_r_v_b") {
		    active_idx = -1;
		    for (var j = i+1; j < netnames.length; ++j) {
			if (netnames[j].tile_y == y)
			    active_idx = j;
		    }
		}
	    }
	    if (active_idx >= 0) {
		if (first_active < 0)
		    first_active = active_idx;
		last_active = active_idx;
	    }
	}
	// Mark active any part of the span that lies between two active
	// tiles. So we can draw the parts of spans that actively route
	// signals, and omit any non-used ends.
	for (var i = first_active; i <= last_active; ++i) {
	    var dbnet = netnames[i];
	    var x1 = dbnet.tile_x;
	    var y1 = dbnet.tile_y;
	    if (!(net in g_tiles[y1][x1].nets))
		g_tiles[y1][x1].nets[net] = tile_net_initdata(kind, dbnet.name);
	}
    }
}


function asc_postprocess(chipdb, ts, asc) {
    // Set active flag.
    var active_bitidx = chipdb.ramb_tile_bits.function['RamConfig.PowerUp'][0];
    // RAMB powerup flag is active-low in 1k device.
    var active_value = (chipdb.device.device == "8k" ? 1 : 0);
    for (var y = 0; y < chipdb.device.height; ++y) {
	if (!(y in ts))
	    continue;
	var ys = ts[y];
	for (var x = 0; x < chipdb.device.width; ++x) {
	    if (!(x in ys))
		continue;
	    var t = ys[x];
	    var typ = t.typ;
	    switch (typ) {
	    case "ramb":
		var powerup = get_bit(t.config_bits, active_bitidx);
		t.active = (powerup == active_value) ? true : false;
		break;
	    case "ramt":
		// Here we use that a ramt is one higher Y index, so processed after ramb.
		t.active = ts[y-1][x].active;
		break;
	    default:
		// Inactive by default; below we will change to active if the
		// tile is actively driving, or driven by, some net.
		t.active = false;
		break;
	    }

	    // Loop over buffers, looking for active signals.
	    var bs = chipdb.tiles[y][x].buffers;
	    var asc_bits = t.config_bits;
	    for (var i = 0; i < bs.length; ++i) {
		var dst_net = bs[i].dst_net;
		var bits = bs[i].config_bits;
		var config_word = 0;
		for (var j = 0; j < bits.length; ++j)
		    config_word |= (get_bit(asc_bits, bits[j]) << j);
		var src_net = bs[i].src_nets[config_word];
		if (src_net >= 0) {
		    var src_kind = chipdb.nets[src_net].kind;
		    var dst_kind = chipdb.nets[dst_net].kind;
		    var src_is_routing = routing_wire_kinds.indexOf(src_kind) >= 0;
		    var dst_is_routing = routing_wire_kinds.indexOf(dst_kind) >= 0;

		    // A tile is deemed active if it has a buffer driving a
		    // net, and which is not solely connecting one routing net
		    // another.
		    if (!(src_is_routing && dst_is_routing))
			t.active = true;

		    // ToDo: maybe process_driven_net() for all nets?
		    if (src_is_routing)
			process_driven_net(src_net, src_kind, t, x, y);
		    if (dst_is_routing)
			process_driven_net(src_net, src_kind, t, x, y);
		}
	    }
	}
    }
}
