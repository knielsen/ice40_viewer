"use strict";
var routing_wire_kinds = ["sp12h", "sp12v", "sp4h", "sp4v", "fb", "glb", "iosp4"];
var routing_spanonly = ["sp12h", "sp12v", "sp4h", "sp4v", "iosp4"];

var g_active_ioin_pins;
var g_active_iopad;

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
	if (idx >= 60+12)
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


// Compute an index that identifies a LUT input. LUT0 inputs have index 0..3,
// up to LUT7 inputs with 28..31.
function lutinput_index(lutinput_name) {
    var idx;

    if (lutinput_name.substr(0, 6) == "lutff_" &&
	lutinput_name.substr(7, 4) == "/in_")
	idx = 4*parseInt(lutinput_name.substr(6, 1)) + parseInt(lutinput_name.substr(11, 1));
    else
	throw "Unable to convert net name '" + span_name + "' to in-tile lutinput index";

    return idx;
}


// Compute an index that identifies an IO output.
//   io_0/D_OUT_[01] maps to 0,1; io_0/OUT_ENB maps to 2.
//   io_1/D_OUT_[01] maps to 3,4; io_1/OUT_ENB maps to 5.
function ioou_index(ioou_name) {
    var idx;

    if (ioou_name.substr(0, 3) == "io_" &&
	ioou_name.substr(4, 7) == "/D_OUT_")
	idx = 3*parseInt(ioou_name.substr(3, 1)) + parseInt(ioou_name.substr(11, 1));
    else if (ioou_name.substr(0, 3) == "io_" &&
	ioou_name.substr(4, 8) == "/OUT_ENB")
	idx = 3*parseInt(ioou_name.substr(3, 1)) + 2;
    else
	throw "Unable to convert net name '" + ioou_name + "' to in-tile IO output index";

    return idx;
}


function ioin_index(ioin_name) {
    var idx;

    if (ioin_name.substr(0, 3) == "io_" &&
	ioin_name.substr(4, 6) == "/D_IN_")
	idx = 2*parseInt(ioin_name.substr(3, 1)) + parseInt(ioin_name.substr(10, 1));
    else
	throw "Unable to convert net name '" + ioin_name + "' to in-tile IO input pin index";

    return idx;
}


// Compute an index to identify a net connected to a LUT input. This can be
// a local net local_gM_N, which has index 4*N+M. It can be lout from the
// previous LUT (if any), index 32..38. It can be cout from the previous LUT
// (if any), index 40..46. Or it can be carry_in_mux, with index 48.
function localOrCarryMux_index(net_name) {
    var idx;

    if (net_name == "carry_in_mux")
	idx = 48;
    else if (net_name.substr(0, 6) == "lutff_" && net_name.substr(7, 5) == "/cout")
	idx = 40 + parseInt(net_name.substr(6, 1));
    else if (net_name.substr(0, 6) == "lutff_" && net_name.substr(7, 5) == "/lout")
	idx = 32 + parseInt(net_name.substr(6, 1));
    else if (net_name.substr(0, 7) == "local_g")
	idx = parseInt(net_name.substr(7, 1)) + 4*parseInt(net_name.substr(9, 1));
    else
	throw "Unable to convert net name '" + net_name + " to local net or carry-in mux.";

    return idx;
}


// Compute an index to identify a local net local_gM_N, index 4*N+M.
function local_index(net_name) {
    var idx;

    if (net_name.substr(0, 7) == "local_g")
	idx = parseInt(net_name.substr(7, 1)) + 4*parseInt(net_name.substr(9, 1));
    else
	throw "Unable to convert net name '" + net_name + " to local net.";

    return idx;
}


// Compute an index to identify a source net routed to a local net.
//       X  sp4h X=0..59  (see span_index() for precise values of X).
//   200+X  sp4v X=0..107
//   400+X  sp12h X=0..25
//   600+X  sp12v X=0..24
//   800+X  out/neighb. LUT+8*N, N indexed as (tile bnl bot bnr lft rgt tnl top tnr)
//  1000+X  glb2local_X; X=0..3
//  1200+X  IO SpanH X=0..15
//  1400+X  IO SpanV X=0..15
function localSrc_index(net_name) {
    var idx;

    if (net_name.substr(0, 8) == "sp4_h_r_") {
	idx = parseInt(net_name.substr(8));
	idx = (idx < 12 ? idx + 48 : (idx ^ 1) - 12);
    } else if (net_name.substr(0, 8) == "sp4_v_b_") {
	idx = parseInt(net_name.substr(8));
	idx = 200 + (idx < 12 ? idx + 48 : (idx ^ 1) - 12);
    } else if (net_name.substr(0, 9) == "sp12_h_r_") {
	idx = parseInt(net_name.substr(9));
	idx = 400 + (idx < 2 ? idx + 24 : (idx ^ 1) - 2);
    } else if (net_name.substr(0, 9) == "sp12_v_b_") {
	idx = parseInt(net_name.substr(9));
	idx = 600 + (idx < 2 ? idx + 24 : (idx ^ 1) - 2);
    } else if (net_name.substr(0, 8) == "sp4_h_l_") {
	idx = parseInt(net_name.substr(8));
    } else if (net_name.substr(0, 8) == "sp4_v_t_") {
	idx = 200 + parseInt(net_name.substr(8));
    } else if (net_name.substr(0, 9) == "sp12_h_l_") {
	idx = 400 + parseInt(net_name.substr(9));
    } else if (net_name.substr(0, 9) == "sp12_v_t_") {
	idx = 600 + parseInt(net_name.substr(9));
    } else if (net_name.substr(0, 10) == "sp4_r_v_b_") {
	idx = parseInt(net_name.substr(10)) + 60;
	if (idx >= 60+12)
	    idx ^= 1;
	idx += 200;
    } else if (net_name.substr(0, 6) == "lutff_" && net_name.substr(7) == "/out") {
	idx = 800 + 0*8 + parseInt(net_name.substr(6, 1));
    } else if (net_name.substr(0, 13) == "neigh_op_bnl_") {
	idx = 800 + 1*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_bot_") {
	idx = 800 + 2*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_bnr_") {
	idx = 800 + 3*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_lft_") {
	idx = 800 + 4*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_rgt_") {
	idx = 800 + 5*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_tnl_") {
	idx = 800 + 6*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_top_") {
	idx = 800 + 7*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "neigh_op_tnr_") {
	idx = 800 + 8*8 + parseInt(net_name.substr(13));
    }
    // LUT outputs from neighbours to IO tile is called logic_op_xxx_N
    else if (net_name.substr(0, 13) == "logic_op_bnl_") {
	idx = 800 + 1*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_bot_") {
	idx = 800 + 2*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_bnr_") {
	idx = 800 + 3*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_lft_") {
	idx = 800 + 4*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_rgt_") {
	idx = 800 + 5*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_tnl_") {
	idx = 800 + 6*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_top_") {
	idx = 800 + 7*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "logic_op_tnr_") {
	idx = 800 + 8*8 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 10) == "glb2local_") {
	idx = 1000 + parseInt(net_name.substr(10));
    } else if (net_name.substr(0, 13) == "span4_horz_l_") {
	idx = 1200 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "span4_vert_t_") {
	idx = 1400 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "span4_horz_r_") {
	idx = parseInt(net_name.substr(13));
	idx = 1200 + (idx < 4 ? idx + 16 : idx - 4);
    } else if (net_name.substr(0, 13) == "span4_vert_b_") {
	idx = parseInt(net_name.substr(13));
	idx = 1400 + (idx < 4 ? idx + 16 : idx - 4);
    } else if (net_name.substr(0, 11) == "span4_horz_") {
	idx = parseInt(net_name.substr(11));
    } else if (net_name.substr(0, 11) == "span4_vert_") {
	idx = 200 + parseInt(net_name.substr(11));
    } else if (net_name.substr(0, 12) == "span12_horz_") {
	idx = 400 + parseInt(net_name.substr(12));
    } else if (net_name.substr(0, 12) == "span12_vert_") {
	idx = 600 + parseInt(net_name.substr(12));
    } else
	throw "Unable to convert net name '" + net_name + "' to src-for-local index.";

    return idx;
}


// Compute an index to identify a source net routed to a span 4/12.
//       X  sp4h X=0..59  (see span_index() for precise values of X).
//   200+X  sp4v X=0..107
//   400+X  sp12h X=0..25
//   600+X  sp12v X=0..24
//   800+X  lutff_X/out (or ram/RDATA_Y, X=Y%8).
//  1000+X  io_M/D_IN_N, X=M*2+N
//  1200+X  IO SpanH X=0..15
//  1400+X  IO SpanV X=0..15
function spanSrc_index(net_name) {
    var idx;

    if (net_name.substr(0, 8) == "sp4_h_r_") {
	idx = parseInt(net_name.substr(8));
	idx = (idx < 12 ? idx + 48 : (idx ^ 1) - 12);
    } else if (net_name.substr(0, 8) == "sp4_v_b_") {
	idx = parseInt(net_name.substr(8));
	idx = 200 + (idx < 12 ? idx + 48 : (idx ^ 1) - 12);
    } else if (net_name.substr(0, 9) == "sp12_h_r_") {
	idx = parseInt(net_name.substr(9));
	idx = 400 + (idx < 2 ? idx + 24 : (idx ^ 1) - 2);
    } else if (net_name.substr(0, 9) == "sp12_v_b_") {
	idx = parseInt(net_name.substr(9));
	idx = 600 + (idx < 2 ? idx + 24 : (idx ^ 1) - 2);
    } else if (net_name.substr(0, 8) == "sp4_h_l_") {
	idx = parseInt(net_name.substr(8));
    } else if (net_name.substr(0, 8) == "sp4_v_t_") {
	idx = 200 + parseInt(net_name.substr(8));
    } else if (net_name.substr(0, 9) == "sp12_h_l_") {
	idx = 400 + parseInt(net_name.substr(9));
    } else if (net_name.substr(0, 9) == "sp12_v_t_") {
	idx = 600 + parseInt(net_name.substr(9));
    } else if (net_name.substr(0, 10) == "sp4_r_v_b_") {
	idx = parseInt(net_name.substr(10)) + 60;
	if (idx >= 60+12)
	    idx ^= 1;
	idx += 200;
    } else if (net_name.substr(0, 6) == "lutff_" && net_name.substr(7) == "/out") {
	idx = 800 + parseInt(net_name.substr(6, 1));
    } else if (net_name.substr(0, 10) == "ram/RDATA_") {
	// Treat BRAM data-out same as LUT outputs.
	idx = 800 + (parseInt(net_name.substr(10)) % 8);
    } else if (net_name.substr(0, 13) == "span4_horz_l_") {
	idx = 1200 +parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "span4_horz_r_") {
	idx = parseInt(net_name.substr(13));
	idx = 1200 + (idx < 4 ? idx + 16 : idx - 4);
    } else if (net_name.substr(0, 13) == "span4_vert_t_") {
	idx = 1400 + parseInt(net_name.substr(13));
    } else if (net_name.substr(0, 13) == "span4_vert_b_") {
	idx = parseInt(net_name.substr(13));
	idx = 1400 + (idx < 4 ? idx + 16 : idx - 4);
    } else if (net_name.substr(0, 11) == "span4_horz_") {
	idx = parseInt(net_name.substr(11));
    } else if (net_name.substr(0, 11) == "span4_vert_") {
	idx = 200 + parseInt(net_name.substr(11));
    } else if (net_name.substr(0, 12) == "span12_horz_") {
	idx = 400 + parseInt(net_name.substr(12));
    } else if (net_name.substr(0, 12) == "span12_vert_") {
	idx = 600 + parseInt(net_name.substr(12));
    } else if (net_name.substr(0, 3) == "io_" && net_name.substr(4, 6) == "/D_IN_") {
	idx = 1000 + 2*parseInt(net_name.substr(3, 1)) + parseInt(net_name.substr(10, 1));
    } else
	throw "Unable to convert net name '" + net_name + "' to src-for-span index.";

    return idx;
}


function net2super(net) {
    var sup;
    if (net >= 0 && net in g_net_connection)
	sup = g_net_connection[net];
    else
	sup = -1;
    return sup;
}


function tile_span_initdata(kind, span_name) {
    var idx = span_index(span_name);
    return { kind: kind, index: idx };
}


// Given a span4 or span12 net that is driven in a tile, mark that tile's part
// of the net active, by inserting an entry in g_tiles[y][x].nets[net]. In
// addition, traverse all tiles covered by the net, and similarly mark active
// any parts on tiles that connect two active parts.
function process_driven_span(net, kind, tile, x, y) {
    var netnames = chipdb.nets[net].names;

    var first_active = -1;
    var last_active = -1;
    var first_active_r_v = -1;
    var last_active_r_v = -1;
    // Find the first and last tile within the active part of the net.
    // Let's utilise that net names are listed in tile order.
    for (var i = 0; i < netnames.length; ++i) {
	var dbnet = netnames[i];
	var x1 = dbnet.tile_x;
	var y1 = dbnet.tile_y;
	// Mark the net active in the tile in which it is driven.
	if (x1 == x && y1 == y && !(net in tile.nets))
	    tile.nets[net] = tile_span_initdata(kind, dbnet.name);

	// If the net is active in this tile, update first/last active
	// as appropriate.
	if (net in g_tiles[y1][x1].nets) {
	    // The extra connections to the left tiles of a vertical span4
	    // are special. They are all at the "end" of the span, so will
	    // not be marked active just because other parts are. But the
	    // part of the span to the right, if any, _will_ need to me
	    // marked active.
	    if (dbnet.name.substr(0, 10) == "sp4_r_v_b_") {
		for (var j = i+1; j < netnames.length; ++j) {
		    if (netnames[j].tile_y == y1) {
			if (first_active_r_v < 0)
			    first_active_r_v = j;
			last_active_r_v = j;
			break;
		    }
		}
	    } else {
		if (first_active < 0)
		    first_active = i;
		last_active = i;
	    }
	}
    }

    if (first_active_r_v >= 0 &&
	(first_active >= 0 || last_active_r_v > first_active_r_v)) {
	if (first_active < 0 || first_active_r_v < first_active)
	    first_active = first_active_r_v;
	if (last_active < 0 || last_active_r_v > last_active)
	    last_active = last_active_r_v;
    }

    // Mark active any part of the span that lies between two active
    // tiles. So we can draw the parts of spans that actively route
    // signals, and omit any non-used ends.
    if (first_active >= 0) {
	for (var i = first_active; i <= last_active; ++i) {
	    var dbnet = netnames[i];
	    var x1 = dbnet.tile_x;
	    var y1 = dbnet.tile_y;
	    if (!(net in g_tiles[y1][x1].nets))
		g_tiles[y1][x1].nets[net] = tile_span_initdata(kind, dbnet.name);
	}
    }
}


function process_driven_local(net, kind, src_net, src_kind, t, x, y) {
    if(net in t.nets)
	console.log("Strange, something else already driving local net " + net);
    var idx = local_index(chipdb.nets[net].names[0].name);
    // Find the name in this tile of the source net, and compute a
    // corresponding index.
    var src_names = chipdb.nets[src_net].names;
    var conn = -1;
    for (var i = 0; i < src_names.length; ++i) {
	var d = src_names[i];
	if (d.tile_x == x && d.tile_y == y) {
	    conn = localSrc_index(d.name);
	    break;
	}
    }
    t.nets[net] = { kind: kind, index: idx, conn: conn };
}


function process_driven_lutinput(net, kind, src_net, t, x, y) {
    var ndata = chipdb.nets[net];
    var idx = lutinput_index(ndata.names[0].name);
    var conn = localOrCarryMux_index(chipdb.nets[src_net].names[0].name);
    if(net in t.nets)
	console.log("Strange, something else already driving lut input " + net);
    t.nets[net] = { kind: kind, index: idx, conn: conn };
}


function process_driven_ioout(net, kind, src_net, t, x, y) {
    var ndata = chipdb.nets[net];
    var idx = ioou_index(ndata.names[0].name);
    var conn = local_index(chipdb.nets[src_net].names[0].name);
    if(net in t.nets)
	console.log("Strange, something else already driving IO output " + net);
    t.nets[net] = { kind: kind, index: idx, conn: conn };
    t.active = true;
    g_active_iopad[Math.floor(idx/3) + 2*(x + chipdb.device.width*y)] = 1;
}


function process_driving_ioin(src_net, t, x, y) {
    // Mark an IO input pin active if it is driving some other net.
    var netnames = chipdb.nets[src_net].names;
    for (var i = 0; i < netnames.length; ++i) {
	var n = netnames[i];
	if (n.name.substr(0,3) == "io_" && n.name.substr(4,6) == "/D_IN_") {
	    var idx = ioin_index(n.name);
	    var arr_idx = n.tile_x+chipdb.device.width*n.tile_y;
	    g_active_ioin_pins[idx+4*arr_idx] = 1;
	    g_active_iopad[Math.floor(idx/2) + 2*arr_idx] = 1;
	    // Make sure a tile with in-use IO pin is marked active.
	    g_tiles[n.tile_y][n.tile_x].active = true;
	    return;
	}
    }
}


function find_connected_nets() {
    var recurse;
    // Use an empty edge list as a marker for already visited graph nodes.
    var visited_marker = [];
    var supernets = [];
    var superid = 0;

    recurse = function(n, dsts, comp) {
	comp.push(n);
	g_net_connection[n] = visited_marker;
	for (var i = 0; i < dsts.length; ++i) {
	    var n2 = dsts[i];
	    if (n2 in g_net_connection && g_net_connection[n2].length > 0)
		recurse(n2, g_net_connection[n2], comp);
	}
    };

    g_net_connection.forEach(function(dsts, n) {
	if (dsts.length > 0) {
	    var comp = [];
	    supernets[superid++] = { nets: comp, syms: [] };
	    recurse(n, dsts, comp);
	}
    });

    // Now we don't need the edge list anymore, replace it with a ref
    // to the supernet, which has all the connected nets.
    // And augment each supernet with a list of symbols from the contained nets.
    g_net_connection = [];
    for (var i = 0; i < supernets.length; ++i) {
	var comp = supernets[i].nets;
	var syms = supernets[i].syms;
	for (var j = 0; j < comp.length; ++j) {
	    var n = comp[j];
	    g_net_connection[n] = i;
	    if (n in g_symtable) {
		var s = g_symtable[n];
		if (syms.indexOf(s) < 0)
		    syms.push(s);
	    }
	    // ToDo: With this, we do not handle singleton nets not connected
	    // to other nets. Should we add such singletons, in case they have
	    // a symbol? But for now, nets not connected to anything else does
	    // not seem very useful to display.
	}
    }
    g_supernets = supernets;
}


// Add an edge in the net-connection graph.
function net_connection_add(net1, net2) {
    if (net1 in g_net_connection)
	g_net_connection[net1].push(net2);
    else
	g_net_connection[net1] = [net2];
    if (net2 in g_net_connection)
	g_net_connection[net2].push(net1);
    else
	g_net_connection[net2] = [net1];
}


function add_span_conn(t, x, y, src_net, dst_net) {
    var netnames = chipdb.nets[src_net].names;
    for (var i = 0; i < netnames.length; ++i) {
	var n = netnames[i];
	if (n.tile_x == x && n.tile_y == y) {
	    var idx = spanSrc_index(n.name);
	    if ("conn" in t.nets[dst_net])
		t.nets[dst_net].conn.push(idx);
	    else
		t.nets[dst_net].conn = [idx];
	    break;
	}
    }
}


function check_buffer_routing_driving(bs, asc_bits, t, x, y) {
    for (var i = 0; i < bs.length; ++i) {
	var dst_net = bs[i].dst_net;
	var bits = bs[i].config_bits;
	var config_word = 0;
	for (var j = 0; j < bits.length; ++j)
	    config_word |= (get_bit(asc_bits, bits[j]) << j);
	var src_net = bs[i].src_nets[config_word];
	if (src_net >= 0) {
	    net_connection_add(src_net, dst_net);

	    var src_kind = chipdb.nets[src_net].kind;
	    var dst_kind = chipdb.nets[dst_net].kind;

	    // A tile is deemed active if it has a buffer driving a
	    // net, and which is not solely connecting one routing net
	    // another.
	    if (!(routing_wire_kinds.indexOf(src_kind) >= 0 &&
		  routing_wire_kinds.indexOf(dst_kind) >= 0))
		t.active = true;

	    if (routing_spanonly.indexOf(src_kind) >= 0)
		process_driven_span(src_net, src_kind, t, x, y);
	    if (routing_spanonly.indexOf(dst_kind) >= 0) {
		process_driven_span(dst_net, dst_kind, t, x, y);
		add_span_conn(t, x, y, src_net, dst_net);
	    }

	    if (dst_kind == 'lcin')
		process_driven_lutinput(dst_net, dst_kind, src_net, t, x, y);
	    else if (dst_kind == 'loc')
		process_driven_local(dst_net, dst_kind, src_net, src_kind, t, x, y);
	    else if (dst_kind == "cmuxin")
		t.carry_in_mux = true;
	    else if (dst_kind == 'ioou')
		process_driven_ioout(dst_net, dst_kind, src_net, t, x, y);

	    if (src_kind == "ioin") {
		process_driving_ioin(src_net, t, x, y);
	    }

	    // ToDo: Something similar for other nets also?
	}
    }
}


// Return the function computed by a LUT, as a 16-bit integer.
// Function is returned big-endian, bit 15, 14, ... 0, so that it will show
// left-to-right when converted to binary.
// LUT input 0 switches most quickly, so that bits 15, 14, ... 8 are the
// outputs for input3=0.
var lutFunctionBits = [4, 14, 15, 5, 6, 16, 17, 7, 3, 13, 12, 2, 1, 11, 10, 0];
function lutFunction(x, y, tile, cell) {
    var config = tile.config_bits;
    var defs = chipdb.logic_tile_bits['function']['LC_'+cell];

    var x = 0;
    for (var i = 0; i < 16; ++i) {
	var idx = defs[lutFunctionBits[i]];
	x = (x<<1) | get_bit(config, idx);
    }
    return x;
}


function calc_luts(t, x, y) {
    t.luts = new Array(8);
    var tile_active = false;
    for (var i = 0; i < 8; ++i) {
	var lut = lutFunction(x, y, t, i);
	var bitIndexes = chipdb.logic_tile_bits.function["LC_" + i.toString()];
	var carryEnable = get_bit(t.config_bits, bitIndexes[8]) != 0;
	var dffEnable = get_bit(t.config_bits, bitIndexes[9]) != 0;
	var lutActive = carryEnable || dffEnable || lut != 0;
	t.luts[i] = { fn: lut, ce: carryEnable, dff: dffEnable, active: lutActive };
	if (lutActive)
	    tile_active = true;
	if (carryEnable) {
	    // Add an edge from carry-out to itself, so that it gets included
	    // as a supernet and get symbols, if any.
	    var net = chipdb.cells.cout[i + 8*(x + chipdb.device.width*y)];
	    if (net >= 0)
		net_connection_add(net, net);
	}
	if (!dffEnable && i < 7) {
	    // Add an edge between lout and lcout - when DFF is not enabled,
	    // there is a direct connection between the pre-DFF lut-cascade
	    // lout net and the post-DFF lcout LUT output net.
	    var lout_net = chipdb.cells.lout[i+7*(x + chipdb.device.width*y)];
	    var lcout_net = chipdb.cells.lcout[i+8*(x + chipdb.device.width*y)];
	    if (lout_net >= 0 && lcout_net >= 0)
		net_connection_add(lout_net, lcout_net);
	}
    }

    return tile_active;
}


function asc_postprocess(chipdb, ts, asc) {
    g_net_connection = [];
    g_active_ioin_pins = new Uint8Array(4*chipdb.device.width*chipdb.device.height);
    g_active_iopad = new Uint8Array(2*chipdb.device.width*chipdb.device.height);

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
	    t.carry_in_mux = false;
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
	    case "logic":
		t.active = calc_luts(t, x, y);
		break;
	    default:
		// Inactive by default; below we will change to active if the
		// tile is actively driving, or driven by, some net.
		t.active = false;
		break;
	    }

	    // Loop over buffers and routings, looking for active signals.
	    check_buffer_routing_driving(chipdb.tiles[y][x].buffers,
					 t.config_bits, t, x, y);
	    check_buffer_routing_driving(chipdb.tiles[y][x].routings,
					 t.config_bits, t, x, y);
	}
    }

    // Traverse the net connection graph, collecting the sets of nets that are
    // connected with each other, as well as their associated symbols, if any.
    find_connected_nets();

    if (drawAll) {
	for (var n = 0; n < chipdb.nets.length; ++n) {
	    var v = chipdb.nets[n];
	    var kind = v.kind;
	    if (routing_spanonly.indexOf(kind) < 0)
		continue;
	    var names = v.names;
	    for (var i = 0; i < names.length; ++i) {
		var x = names[i].tile_x;
		var y = names[i].tile_y;
		if (!(n in g_tiles[y][x].nets))
		    g_tiles[y][x].nets[n] = tile_span_initdata(kind, names[i].name);
	    }
	}
    }
}
