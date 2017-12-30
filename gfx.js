"use strict";
var drawAll = false;
var gfx_showNetNumbers;
var gfx_drawSpans;
var gfx_drawLocals;

var highLightSupernet = undefined;


function canvas2world(canvas, cx, cy) {
    var wx, wy;
    var cw = canvas.width;
    var ch = canvas.height;
    wx = view_x0 + cx/cw*(view_x1-view_x0);
    wy = view_y0 + (ch-cy)/ch*(view_y1-view_y0);
    return [wx, wy];
}


function world2canvas(canvas, wx, wy) {
    var cx, cy;
    var cw = canvas.width;
    var ch = canvas.height;
    cx = (wx - view_x0)/(view_x1 - view_x0)*cw;
    cy = ch - (wy - view_y0)/(view_y1 - view_y0)*ch;
    // Canvas seems to consider the position of a pixel to be in the middle
    // between the integer coordinates. So by using .5 coordinates, we get
    // single-pixel lines rather than double-pixel antialiased (and thus
    // somewhat blurry) lines.
    return [Math.ceil(cx)+0.5, Math.ceil(cy)+0.5];
}


function worldFillRect(canvas, wx0, wy0, wx1, wy1) {
    var a = world2canvas(canvas, wx0, wy1);
    var b = world2canvas(canvas, wx1, wy0);
    canvas.getContext("2d").fillRect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
}


function worldFilledPoly(canvas, c, corners) {
    c.beginPath();
    for (var i = 0; i < corners.length; i += 2) {
	if (i == 0)
	    worldMoveTo(canvas, c, corners[i], corners[i+1]);
	else
	    worldLineTo(canvas, c, corners[i], corners[i+1]);
    }
    c.fill();
}
	

function worldRect(canvas, wx0, wy0, wx1, wy1) {
    var a = world2canvas(canvas, wx0, wy1);
    var b = world2canvas(canvas, wx1, wy0);
    canvas.getContext("2d").rect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
}


function worldMoveTo(canvas, c, wx, wy) {
    var a = world2canvas(canvas, wx, wy);
    c.moveTo(a[0], a[1]);
}


function worldLineTo(canvas, c, wx, wy) {
    var a = world2canvas(canvas, wx, wy);
    c.lineTo(a[0], a[1]);
}


function worldHFillText(canvas, c, label, wx, wy, wmax) {
    var a = world2canvas(canvas, wx, wy);
    if (wmax > 0) {
	var m = wmax/(view_x1 - view_x0)*canvas.width;
	c.fillText(label, a[0], a[1], m);
    } else
	c.fillText(label, a[0], a[1]);
}


function worldVFillText(canvas, c, label, wx, wy, wmax) {
    var a = world2canvas(canvas, wx, wy);
    c.save();
    c.translate(a[0], a[1]);
    c.rotate(Math.PI/2);
    if (wmax > 0) {
	var m = wmax/(view_x1 - view_x0)*canvas.height;
	c.fillText(label, 0, 0, m);
    } else
	c.fillText(label, 0, 0);
    c.restore();
}


function canvas2TileXY(canvas, cx, cy) {
    var w = canvas2world(canvas, cx, cy);
    return [Math.round(w[0]), Math.round(w[1]), w[0], w[1]];
}


var wire_coords;
var wire_types;
var wire_supernets;
var wire_count;
var junction_coords;
var junction_types;
var junction_supernets;
var junction_count;
var text_coords;
var text_types;
var text_nets;
var text_supernets;
var text_count;
var tile_wire_idx
var tile_junction_idx;
var tile_text_idx;
// For each local net in each tile, index of junction on driving net, or -1.
var local_junction_idx;
// for each LUT, a 4-bit value of which inputs are driven.
// Indexed as lut+8*(tile_x+width*tile_y).
var lut_input_drive;

var init_wire_count = 100000;
var init_junction_count = 50000;
var init_text_count = 50000;

// Wire types.
var WT_SP4H = 0;
var WT_SP4V = 1;
var WT_SP12H = 2;
var WT_SP12V = 3;
var WT_SPSP = 4;
var WT_LUTIN = 5;
var WT_LUTCOUT = 6;
var WT_LUTLCOUT = 7;
var WT_LOCAL = 8;
var WT_IOOU = 9;
// Junction types.
// For now, uses same types as wires, WT_xxx
// var JT_DEFAULT = 0;
// Text types.
var TT_SYMBOL_H = 0;
var TT_SYMBOL_V = 1;


function wire_add(wire_type, wire_supernet, x0, y0, x1, y1) {
    if (4*wire_count >= wire_coords.length) {
	var new_len = Math.ceil(wire_count*3/2);
	var tmp1 = new Float32Array(4*new_len);
	var tmp2 = new Uint32Array(new_len);
	var tmp3 = new Int32Array(new_len);
	tmp1.set(wire_coords);
	tmp2.set(wire_types);
	tmp3.set(wire_supernets);
	wire_coords = tmp1;
	wire_types = tmp2;
	wire_supernets = tmp3;
    }
    var idx = 4*wire_count;
    wire_coords[idx++] = x0;
    wire_coords[idx++] = y0;
    wire_coords[idx++] = x1;
    wire_coords[idx++] = y1;
    wire_types[wire_count] = wire_type;
    wire_supernets[wire_count++] = wire_supernet;
}


function junction_add(junction_type, junction_supernet, x0, y0) {
    if (2*junction_count >= junction_coords.length) {
	var new_len = Math.ceil(junction_count*3/2);
	var tmp1 = new Float32Array(2*new_len);
	var tmp2 = new Uint32Array(new_len);
	var tmp3 = new Int32Array(new_len);
	tmp1.set(junction_coords);
	tmp2.set(junction_types);
	tmp3.set(junction_supernets);
	junction_coords = tmp1;
	junction_types = tmp2;
	junction_supernets = tmp3;
    }
    var junctionId = junction_count;
    var idx = 2*junction_count;
    junction_coords[idx++] = x0;
    junction_coords[idx++] = y0;
    junction_types[junction_count] = junction_type;
    junction_supernets[junction_count++] = junction_supernet;
    return junctionId;
}


function text_add(text_type, text_net, text_supernet, x0, y0) {
    if (2*text_count >= text_coords.length) {
	var new_len = Math.ceil(text_count*3/2);
	var tmp1 = new Float32Array(2*new_len);
	var tmp2 = new Uint32Array(new_len);
	var tmp3 = new Uint32Array(new_len);
	var tmp4 = new Int32Array(new_len);
	tmp1.set(text_coords);
	tmp2.set(text_types);
	tmp3.set(text_nets);
	tmp4.set(text_supernets);
	text_coords = tmp1;
	text_types = tmp2;
	text_nets = tmp3;
	text_supernets = tmp4;
    }
    var idx = 2*text_count;
    text_coords[idx++] = x0;
    text_coords[idx++] = y0;
    text_types[text_count] = text_type;
    text_nets[text_count] = text_net;
    text_supernets[text_count++] = text_supernet;
}


function gfx_init() {
    var cw = chipdb.device.width;
    var ch = chipdb.device.height;
    wire_coords = new Float32Array(4*init_wire_count);
    wire_types = new Uint32Array(init_wire_count);
    wire_supernets = new Uint32Array(init_wire_count);
    wire_count = 0;
    junction_coords = new Float32Array(2*init_junction_count);
    junction_types = new Uint32Array(init_junction_count);
    junction_supernets = new Uint32Array(init_junction_count);
    junction_count = 0;
    text_coords = new Float32Array(2*init_text_count);
    text_types = new Uint32Array(init_text_count);
    text_nets = new Uint32Array(init_text_count);
    text_supernets = new Int32Array(init_text_count);
    text_count = 0;
    tile_wire_idx = new Uint32Array(2*cw*ch);
    tile_junction_idx = new Uint32Array(2*cw*ch);
    tile_text_idx = new Uint32Array(2*cw*ch);
    local_junction_idx = new Int32Array(32*cw*ch);
    local_junction_idx.fill(-1);

    lut_input_drive = new Uint8Array(8*cw*ch);
}


function mk_tiles(chipdb) {
    var ts;
    var x, y;

    var w = chipdb.device.width;
    var h = chipdb.device.height;
    ts = [];
    for (y = 0; y < h; ++y) {
	ts[y] = [];
	for (x = 0; x < w; ++x) {
	    if (!(y in chipdb.tiles) || !(x in chipdb.tiles[y]))
		continue;
	    var typ = chipdb.tiles[y][x].typ;
	    ts[y][x] = { typ: typ, nets: { } };
	}
    }

    return ts;
}


function tileCol(typ, active) {
    switch (typ) {
    case "io":
	return active ? "#AAEEEE" : "#88AAAA";
    case "logic":
	return active ? "#EEAAEE" : "#a383a3";
    case "ramb":
	return active ? "#EEEEAA" : "#AAAA88";
    case "ramt":
	return active ? "#EEEEAA" : "#AAAA88";
    default:
	return "#000000";
    }
}


var tileEdge = 0.42;
var wireSpc = 0.0102;
var span4Base = - 0.4;
var span12Base = 0.4 - (12*2-1)*wireSpc;
var spanShort = -0.37;
var spanShort2 = -0.282;
var labelMax = 0.4;

function calcOneSpan4H(x, y, i, j, net, supernet, conn) {
    var x1 = x - 0.5;
    var x2 = x + 0.5;
    var x6 = x + spanShort;
    var x7 = x - spanShort;
    var y1 = y + span4Base + (13*i+j)*wireSpc;
    var y2 = y1 + (13 + 1)*wireSpc;
    var y3 = y1 + (13 - 1)*wireSpc;
    var y4 = y + span4Base + j*wireSpc;
    if (i < 3) {
	// Crossed-over wires.
	var x3 = x - (7-20)*wireSpc;
	var x4 = x - (5-20)*wireSpc;
	var x5 = x + (6+20)*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP4H, supernet, x1, y1, x3, y1);
	    wire_add(WT_SP4H, supernet, x3, y1, x5, y2);
	    wire_add(WT_SP4H, supernet, x5, y2, x2, y2);
	} else {
	    wire_add(WT_SP4H, supernet, x1, y1, x4, y1);
	    wire_add(WT_SP4H, supernet, x4, y1, x5, y3);
	    wire_add(WT_SP4H, supernet, x5, y3, x2, y3);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 3) {
	// Connection on left that terminate in this tile.
	wire_add(WT_SP4H, supernet, x1, y1, x6, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 4) {
	// Connection on bottom that originates in this tile.
	wire_add(WT_SP4H, supernet, x7, y4, x2, y4);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x7, y4);
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    if (idx < 200) {
		// Sp4h<->sp4h. Only the sp4's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor(idx/12);
		var srcj = idx%12;
		if ((i == 3 || i == 4) && (srci == 3 || srci == 4)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 3) {
			jx1 = x6;
			jy1 = y1;
		    } else {
			jx1 = x7;
			jy1 = y4;
		    }
		    if (srci == 3) {
			jx2 = x + spanShort;
			jy2 = y + span4Base + (13*srci+srcj)*wireSpc;
		    } else {
			jx2 = x - spanShort;
			jy2 = y + span4Base + srcj*wireSpc;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 400) {
		// Sp4v<->sp4h. Only the sp4's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx-200)/12);
		var srcj = (idx-200)%12;
		if ((i == 3 || i == 4) && (srci == 3 || srci == 4)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 3) {
			jx1 = x6;
			jy1 = y1;
		    } else {
			jx1 = x7;
			jy1 = y4;
		    }
		    if (srci == 3) {
			jx2 = x + span4Base + (13*srci+srcj)*wireSpc;
			jy2 = y - spanShort;
		    } else {
			jx2 = x + span4Base + srcj*wireSpc
			jy2 = y + span4Base + (srcj-0.5)*wireSpc;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    if (srci == 3)
			junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 600) {
		// Sp12h->sp4h. Only i=0 is possible.
		var srci = Math.floor((idx-400)/2);
		var srcj = (idx-400)%2;
		var jx1 = x + span4Base + (13*3+1.5+j)*wireSpc;
		var jy1 = y1;
		var jx2, jy2;
		if (srci == 12) {
		    jx2 = x - spanShort;
		    jy2 = y + span12Base + srcj*wireSpc;
		} else if (srci == 11) {
		    // Empty case; sp12h's that terminate in the tile do not
		    // drive sp4h's.
		} else {
		    jx2 = jx1;
		    jy2 = y + span12Base + (2*(srci+1)+srcj+((srcj%2==0) ? 1 : -1))*wireSpc;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		junction_add(WT_SPSP, supernet, jx2, jy2);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else if (idx < 800) {
		throw "unexpected src sp12v (index " + idx.toString() + ") driving sp4h";
	    } else if (idx < 1000) {
		// LUT output -> sp4h.
		var lut = idx - 800;
		var jx1 = x + gfx_lc_base + gfx_lc_w + gfx_lcout_sz;
		var jy1 = y + (lut-3.5)*(2*tileEdge)/8;
		var jx2, jy2;
		if (i < 3) {
		    jx2 = x + tileEdge;
		    jy2 = (j%2)==0 ? y2 : y3;
		} else if (i == 3) {
		    // Empty case, as sp4h that terminate in a tile are not
		    // connected to LUT outputs in that tile.
		} else {
		    jx2 = x7;
		    jy2 = y4;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		junction_add(WT_SPSP, supernet, jx2, jy2);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else {
		// ToDo: IO tile?
		throw "Unexpected src idx " + idx.toString() + " connected to sp4h.";
	    }
	}
    }
}


function calcOneSpan12H(x, y, i, j, net, supernet, conn) {
    var x1 = x - 0.5;
    var x2 = x + 0.5;
    var y1 = y + span12Base + (2*i+j)*wireSpc;
    var y2 = y+span12Base + (2*(i+1)+j+1)*wireSpc;
    var y3 = y+span12Base + (2*(i+1)+j-1)*wireSpc;
    if (i < 11) {
	var x3 = x - 2*wireSpc;
	var x4 = x - 0*wireSpc;
	var x5 = x + 1*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP12H, supernet, x1, y1, x3, y1);
	    wire_add(WT_SP12H, supernet, x3, y1, x5, y2);
	    wire_add(WT_SP12H, supernet, x5, y2, x2, y2);
	} else {
	    wire_add(WT_SP12H, supernet, x1, y1, x4, y1);
	    wire_add(WT_SP12H, supernet, x4, y1, x5, y3);
	    wire_add(WT_SP12H, supernet, x5, y3, x2, y3);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 11) {
	var x6 = x + spanShort;
	wire_add(WT_SP12H, supernet, x1, y1, x6, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 12) {
	var x7 = x - spanShort;
	var y4 = y + span12Base + j*wireSpc;
	wire_add(WT_SP12H, supernet, x7, y4, x2, y4);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x7, y4);
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    if (idx < 400) {
		throw "unexpected src sp4[hv] (index " + idx.toString() + ") driving sp12h";
	    } else if (idx < 600) {
		// Sp12h<->sp12h. Only the sp12's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx - 400)/2);
		var srcj = (idx - 400)%2;
		if ((i == 11 || i == 12) && (srci == 11 || srci == 12)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 11) {
			jx1 = x + spanShort;
			jy1 = y1;
		    } else {
			jx1 = x - spanShort;
			jy1 = y + span12Base + j*wireSpc;
		    }
		    if (srci == 11) {
			jx2 = x + spanShort;
			jy2 = y + span12Base + (2*srci+srcj)*wireSpc;
		    } else {
			jx2 = x - spanShort;
			jy2 = y + span12Base + srcj*wireSpc;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 800) {
		// Sp12v<->sp12h. Only the sp12's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx - 600)/2);
		var srcj = (idx - 600)%2;
		if ((i == 11 || i == 12) && (srci == 11 || srci == 12)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 11) {
			jx1 = x + spanShort;
			jy1 = y1;
		    } else {
			jx1 = x - spanShort;
			jy1 = y + span12Base + j*wireSpc;
		    }
		    if (srci == 11) {
			jx2 = x + span12Base + (2*srci+srcj)*wireSpc;
			jy2 = y - spanShort;
		    } else {
			jx2 = x + span12Base + srcj*wireSpc
			jy2 = y + spanShort;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 1000) {
		// LUT output -> sp12h.
		var lut = idx - 800;
		var jx1 = x + gfx_lc_base + gfx_lc_w + gfx_lcout_sz;
		var jy1 = y + (lut-3.5)*(2*tileEdge)/8;
		var jx2, jy2;
		if (i < 11) {
		    jx2 = x + tileEdge;
		    jy2 = (j%2)==0 ? y2 : y3;
		} else if (i == 11) {
		    // This is actually dead code, as sp12h that terminate in
		    // a tile are not connected to LUT outputs in that tile.
		    jx2 = x - tileEdge;
		    jy2 = y1;
		} else {
		    jx2 = x + tileEdge;
		    jy2 = y + span12Base + j*wireSpc;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		junction_add(WT_SPSP, supernet, jx2, jy2);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else
		throw "Unexpected src idx " + idx.toString() + " connected to sp12h.";
	}
    }
}


function calcOneSpan4V(x, y, i, j, net, supernet, conn) {
    var x1 = x + span4Base + (13*(i%4)+j)*wireSpc;
    var x2 = x + span4Base + (13*(i+1)+j+1)*wireSpc;
    var x3 = x + span4Base + (13*(i+1)+j-1)*wireSpc;
    var x4 = x - 0.5;
    var x5 = x + 0.5;
    var x8 = x - spanShort - wireSpc;
    var y1 = y + 0.5;
    var y2 = y - 0.5;
    var y6 = y - spanShort;
    var y8 = y + span4Base + (13*((i+1)%5)+j-0.5)*wireSpc;
    var y9 = y + span4Base + (13*(i-5)+j-0.5)*wireSpc;
    if (i < 3) {
	var y3 = y + (7+20)*wireSpc;
	var y4 = y + (5+20)*wireSpc;
	var y5 = y - (6-20)*wireSpc;
	// Crossed-over wires.
	if ((j % 2) == 0) {
	    wire_add(WT_SP4V, supernet, x1, y1, x1, y3);
	    wire_add(WT_SP4V, supernet, x1, y3, x2, y5);
	    wire_add(WT_SP4V, supernet, x2, y5, x2, y2);
	    // Connection to the tile on the left.
	    wire_add(WT_SP4V, supernet, x2, y8, x4, y8);
	    // Interconnect dots.
	    junction_add(WT_SP4V, supernet, x2, y8);
	} else {
	    wire_add(WT_SP4V, supernet, x1, y1, x1, y4);
	    wire_add(WT_SP4V, supernet, x1, y4, x3, y5);
	    wire_add(WT_SP4V, supernet, x3, y5, x3, y2);
	    // Connection to the tile on the left.
	    wire_add(WT_SP4V, supernet, x3, y8, x4, y8);
	    // Interconnect dots.
	    junction_add(WT_SP4V, supernet, x3, y8);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 3) {
	// Connection on top that terminate in this tile.
	wire_add(WT_SP4V, supernet, x1, y1, x1, y6);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 4) {
	var y7 = y + spanShort2;
	// Connection on bottom that originates in this tile.
	wire_add(WT_SP4V, supernet, x1, y7, x1, y2);
	// Connection to the tile on the left.
	wire_add(WT_SP4V, supernet, x1, y8, x4, y8);
	// Interconnect dots.
	junction_add(WT_SP4V, supernet, x1, y8);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y7);
    } else if (i >= 5) {
	// Connection to the span4v of the tile column on the right of this tile.
	wire_add(WT_SP4V, supernet, x8, y9, x5, y9);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, x8, y9);
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    if (idx < 200) {
		// Sp4h<->sp4v. Only the sp4's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor(idx/12);
		var srcj = idx%12;
		if ((i == 3 || i == 4) && (srci == 3 || srci == 4)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 3) {
			jx1 = x1;
			jy1 = y6;
		    } else {
			jx1 = x1;
			jy1 = y8;
		    }
		    if (srci == 3) {
			jx2 = x + spanShort;
			jy2 = y + span4Base + (13*srci+srcj)*wireSpc;
		    } else {
			jx2 = x - spanShort;
			jy2 = y + span4Base + srcj*wireSpc;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 400) {
		// Sp4v<->sp4v. Only the sp4's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx-200)/12);
		var srcj = (idx-200)%12;
		if ((i == 3 || i == 4) && (srci == 3 || srci == 4)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 3) {
			jx1 = x1;
			jy1 = y6;
		    } else {
			jx1 = x1;
			jy1 = y8;
		    }
		    if (srci == 3) {
			jx2 = x + span4Base + (13*srci+srcj)*wireSpc;
			jy2 = y - spanShort;
		    } else {
			jx2 = x + span4Base + srcj*wireSpc;
			jy2 = y + span4Base + (srcj-0.5)*wireSpc;
		    }
		    if (i == 3)
			junction_add(WT_SPSP, supernet, jx1, jy1);
		    if (srci == 3)
			junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 600) {
		throw "unexpected src sp12h (index " + idx.toString() + ") driving spvh";
	    } else if (idx < 800) {
		// Sp12v->sp4v. Only i=0 is possible.
		var srci = Math.floor((idx-600)/2);
		var srcj = (idx-600)%2;
		var jx1 = x1;
		var jy1 = y + span12Base + (12.5 + j)*wireSpc;
		var jx2, jy2;
		if (srci == 12) {
		    jx2 = x + span12Base + srcj*wireSpc;
		    jy2 = y + spanShort;
		} else if (srci == 11) {
		    // Empty case; sp12v's that terminate in the tile do not
		    // drive sp4h's.
		} else {
		    jx2 = x + span12Base + (2*srci+srcj)*wireSpc;
		    jy2 = jy1;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		junction_add(WT_SPSP, supernet, jx2, jy2);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else if (idx < 1000) {
		// LUT output -> sp4v.
		var lut = idx - 800;
		var jx1 = x + gfx_lc_base + gfx_lc_w + gfx_lcout_sz;
		var jy1 = y + (lut-3.5)*(2*tileEdge)/8;
		var jx2, jy2;
		if (i < 3) {
		    jx2 = ((j%2)==0) ? x2 : x3;
		    jy2 = y8;
		} else if (i == 3) {
		    // Empty case, as sp4v that terminate in a tile are not
		    // connected to LUT outputs in that tile.
		} else if (i == 4) {
		    jx2 = x1;
		    jy2 = y8;
		} else {
		    jx2 = x8;
		    jy2 = y9;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else {
		// ToDo: IO tile?
		throw "Unexpected src idx " + idx.toString() + " connected to sp4v.";
	    }
	}
    }
}


function calcOneSpan12V(x, y, i, j, net, supernet, conn) {
    var x1 = x + span12Base + (2*i+j)*wireSpc;
    var x2 = x + span12Base + (2*(i+1)+j+1)*wireSpc;
    var x3 = x + span12Base + (2*(i+1)+j-1)*wireSpc;
    var x4 = x + span12Base + j*wireSpc;
    var y1 = y + 0.5;
    var y2 = y - 0.5;
    var y7 = y + spanShort;
    if (i < 11) {
	var y3 = y + 2*wireSpc;
	var y4 = y + 0*wireSpc;
	var y5 = y - 1*wireSpc;
	if ((j % 2) == 0) {
	    wire_add(WT_SP12V, supernet, x1, y1, x1, y3);
	    wire_add(WT_SP12V, supernet, x1, y3, x2, y5);
	    wire_add(WT_SP12V, supernet, x2, y5, x2, y2);
	} else {
	    wire_add(WT_SP12V, supernet, x1, y1, x1, y4);
	    wire_add(WT_SP12V, supernet, x1, y4, x3, y5);
	    wire_add(WT_SP12V, supernet, x3, y5, x3, y2);
	}
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 11) {
	var y6 = y - spanShort;
	wire_add(WT_SP12V, supernet, x1, y1, x1, y6);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else {
	wire_add(WT_SP12V, supernet, x4, y7, x4, y2);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x4, y7);
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    if (idx < 400) {
		throw "unexpected src sp4[hv] (index " + idx.toString() + ") driving sp12v";
	    } else if (idx < 600) {
		// Sp12h<->sp12v. Only the sp12's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx - 400)/2);
		var srcj = (idx - 400)%2;
		if ((i == 11 || i == 12) && (srci == 11 || srci == 12)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 11) {
			jx1 = x1;
			jy1 = y - spanShort;
		    } else {
			jx1 = x + span12Base + j*wireSpc;
			jy1 = y + spanShort;
		    }
		    if (srci == 11) {
			jx2 = x + spanShort;
			jy2 = y + span12Base + (2*srci+srcj)*wireSpc;
		    } else {
			jx2 = x - spanShort
			jy2 = y + span12Base + srcj*wireSpc;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 800) {
		// Sp12v<->sp12v. Only the sp12's that start or terminate in a
		// tile can be routed to each other.
		var srci = Math.floor((idx - 600)/2);
		var srcj = (idx - 600)%2;
		if ((i == 11 || i == 12) && (srci == 11 || srci == 12)) {
		    var jx1, jx2, jy1, jy2;
		    if (i == 11) {
			jx1 = x1;
			jy1 = y - spanShort;
		    } else {
			jx1 = x + span12Base + j*wireSpc;
			jy1 = y + spanShort;
		    }
		    if (srci == 11) {
			jx2 = x + span12Base + (2*srci+srcj)*wireSpc;
			jy2 = y - spanShort;
		    } else {
			jx2 = x + span12Base + srcj*wireSpc;
			jy2 = y + spanShort;
		    }
		    junction_add(WT_SPSP, supernet, jx1, jy1);
		    junction_add(WT_SPSP, supernet, jx2, jy2);
		    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
		}
	    } else if (idx < 1000) {
		// LUT output -> sp12v.
		var lut = idx - 800;
		var jx1 = x + gfx_lc_base + gfx_lc_w + gfx_lcout_sz;
		var jy1 = y + (lut-3.5)*(2*tileEdge)/8;
		var jx2, jy2;
		var jx2;
		if (i < 11) {
		    if (lut >= 4) {
			jx2 = x1;
			jy2 = jy1 + tileEdge/8;
		    } else {
			jx2 = ((j%2) == 0) ? x2 : x3;
			jy2 = jy1 - tileEdge/8;
		    }
		} else if (i == 11) {
		    // This case does not occur, as sp12v that terminate in
		    // a tile are not connected to LUT outputs in that tile.
		} else {
		    jx2 = x4;
		    jy2 = (lut == 0) ? y - tileEdge : y7;
		}
		junction_add(WT_SPSP, supernet, jx1, jy1);
		junction_add(WT_SPSP, supernet, jx2, jy2);
		wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	    } else
		throw "Unexpected src idx " + idx.toString() + " connected to sp12v.";
	}
    }
}


function calcOneIOSpan4H(x, y, i, j, net, supernet, conn) {
    var x2, x7, x_t;
    if (x == 0) {
	x2 = x + 0.5;
	x_t = x7 = x - spanShort;
    } else {
	x_t = x2 = x - 0.5;
	x7 = x + spanShort;
    }
    var y1 = y + span4Base + (13*i+j)*wireSpc;
    wire_add(WT_SP4H, supernet, x7, y1, x2, y1);
    if (net != undefined)
	text_add(TT_SYMBOL_H, net, supernet, x_t, y1);

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx, jy;

	    if (idx < 200) {
		// Sp4h<->sp4h.
		var srci = Math.floor(idx/12);
		var srcj = idx%12;
		jx = x7;
		jy = y + span4Base + (13*srci+srcj)*wireSpc;
	    } else if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> sp4h.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx = coords[1];
		jy = coords[3];
	    } else if (idx >= 1400 && idx < 1600) {
		// Sp4h<->io span4v.
		var srci = Math.floor((idx-1400)/4);
		var srcj = (idx-1400)%4;
		if (srci <= 3) {
		    jx = x + span4Base + (5*srci+srcj)*wireSpc;
		    jy = y - spanShort;
		} else {
		    jx = x + span4Base + (5*(srci-4)+srcj)*wireSpc;
		    jy = y + spanShort;
		}
	    } else {
		// ToDo: IO tile?
		throw "Unexpected src idx " + idx.toString() + " connected to sp4h.";
	    }
	    junction_add(WT_SPSP, supernet, x7, y1);
	    junction_add(WT_SPSP, supernet, jx, jy);
	    wire_add(WT_SPSP, supernet, x7, y1, jx, jy);
	}
    }
}


function calcOneIOSpan12H(x, y, i, j, net, supernet, conn) {
    var x2, x7, t_x;
    if (x == 0) {
	x2 = x + 0.5;
	t_x = x7 = x - spanShort;
    } else {
	t_x = x2 = x - 0.5;
	x7 = x + spanShort;
    }
    var y1 = y + span12Base + (12*i+j)*wireSpc;
    wire_add(WT_SP12H, supernet, x7, y1, x2, y1);
    if (net != undefined)
	text_add(TT_SYMBOL_H, net, supernet, t_x, y1);

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx, jy;

	    if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> sp12h.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx = coords[1];
		jy = coords[3];
	    } else {
		throw "Unexpected src idx " + idx.toString() + " connected to sp4v.";
	    }
	    junction_add(WT_SPSP, supernet, x7, y1);
	    junction_add(WT_SPSP, supernet, jx, jy);
	    wire_add(WT_SPSP, supernet, x7, y1, jx, jy);
	}
    }
}


function calcOneIOSpanH(x, y, i, j, net, supernet, conn) {
    var x1 = x - 0.5;
    var x2 = x + 0.5;
    var y1 = y + span4Base + (5*(i%4)+j)*wireSpc;
    var jx1;
    var jy1 = y1;
    if (i < 3) {
	// Wires that connect through from left to right.
	var x3 = x - (6-20)*wireSpc;
	var x5 = x + (6+20)*wireSpc;
	var y2 = y + span4Base + (5*(i+1)+j)*wireSpc;
	jx1 = x + spanShort;
	wire_add(WT_SP4H, supernet, x1, y1, x3, y1);
	wire_add(WT_SP4H, supernet, x3, y1, x5, y2);
	wire_add(WT_SP4H, supernet, x5, y2, x2, y2);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else if (i == 3) {
	// Wires that terminate at the left of the IO cell.
	var x6 = jx1 = x + spanShort;
	wire_add(WT_SP4H, supernet, x1, y1, x6, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x1, y1);
    } else {
	// Wires that originate at the right of the IO cell.
	var x7 = jx1 = x - spanShort;
	wire_add(WT_SP4H, supernet, x7, y1, x2, y1);
	if (net != undefined)
	    text_add(TT_SYMBOL_H, net, supernet, x7, y1);
    }

    // Handle wires that go "around the corner".
    if ((y == 0 || y == chipdb.device.height-1) && i <= 3) {
	if (x == 1) {
	    var x8 = (x-1) + span4Base + (5*i+j)*wireSpc;
	    wire_add(WT_SP4H, supernet, x8, y1, x1, y1);
	} else if (x == chipdb.device.width - 2) {
	    var x8 = (x+1) + span4Base + (5*i+j)*wireSpc;
	    wire_add(WT_SP4H, supernet, x2, y1, x8, y1);
	}
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx2, jy2;

	    if (idx >= 200 && idx < 400) {
		// Spanh<->sp4v.
		var srci = Math.floor((idx-200)/12);
		var srcj = (idx-200)%12;
		jx2 = x + span4Base + (13*srci+srcj)*wireSpc;
		jy2 = (y == 0 ? y - spanShort : y + spanShort);
	    } else if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> io spanh.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx2 = coords[1];
		jy2 = coords[3];
	    } else if (idx >= 1200 && idx < 1400) {
		// io spanh<->io spanh.
		var srci = Math.floor((idx-1200)/4);
		var srcj = (idx-1200)%4;
		if (srci <= 3) {
		    jx2 = x + spanShort;
		    jy2 = y + span4Base + (5*srci+j)*wireSpc;
		} else {
		    jx2 = x - spanShort;
		    jy2 = y + span4Base + (5*(srci-4)+j)*wireSpc;
		}
	    } else {
		throw "Unexpected src idx " + idx.toString() + " connected to spanv.";
	    }
	    junction_add(WT_SPSP, supernet, jx1, jy1);
	    junction_add(WT_SPSP, supernet, jx2, jy2);
	    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	}
    }
}


function calcOneIOSpan4V(x, y, i, j, net, supernet, conn) {
    var x1 = x + span4Base + (13*i+j)*wireSpc;
    var y1, y6, t_y;
    if (y == 0) {
	t_y = y1 = y + 0.5;
	y6 = y - spanShort;
	
    } else {
	y1 = y - 0.5;
	t_y = y6 = y + spanShort;
    }
    wire_add(WT_SP4V, supernet, x1, y1, x1, y6);
    if (net != undefined)
	text_add(TT_SYMBOL_V, net, supernet, x1, t_y);

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx, jy;

	    if (idx >= 200 && idx < 400) {
		// SpanV<->sp4v.
		var srci = Math.floor((idx-200)/12);
		var srcj = (idx-200)%12;
		jx = x + span4Base + (13*srci+srcj)*wireSpc;
		jy = y6;
	    } else if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> sp4v.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx = coords[1];
		jy = coords[3];
	    } else if (idx >= 1200 && idx < 1400) {
		// Sp4v<->io spanh.
		var srci = Math.floor((idx-1200)/4);
		var srcj = (idx-1200)%4;
		if (srci <= 3) {
		    jx = x + spanShort;
		    jy = y + span4Base + (5*srci+srcj)*wireSpc;
		} else {
		    jx = x - spanShort;
		    jy = y + span4Base + (5*(srci-4)+srcj)*wireSpc;
		}
	    } else {
		throw "Unexpected src idx " + idx.toString() + " connected to sp4v.";
	    }
	    junction_add(WT_SPSP, supernet, x1, y6);
	    junction_add(WT_SPSP, supernet, jx, jy);
	    wire_add(WT_SPSP, supernet, x1, y6, jx, jy);
	}
    }
}


function calcOneIOSpan12V(x, y, i, j, net, supernet, conn) {
    var x1 = x + span12Base + (12*i+j)*wireSpc;
    var y1, y6, t_y;
    if (y == 0) {
	t_y = y1 = y + 0.5;
	y6 = y - spanShort;
	
    } else {
	y1 = y - 0.5;
	t_y = y6 = y + spanShort;
    }
    wire_add(WT_SP12V, supernet, x1, y1, x1, y6);
    if (net != undefined)
	text_add(TT_SYMBOL_V, net, supernet, x1, t_y);

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx, jy;

	    if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> sp12v.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx = coords[1];
		jy = coords[3];
	    } else {
		throw "Unexpected src idx " + idx.toString() + " connected to sp4v.";
	    }
	    junction_add(WT_SPSP, supernet, x1, y6);
	    junction_add(WT_SPSP, supernet, jx, jy);
	    wire_add(WT_SPSP, supernet, x1, y6, jx, jy);
	}
    }
}


function calcOneIOSpanV(x, y, i, j, net, supernet, conn) {
    var x1 = x + span4Base + (5*(i%4)+j)*wireSpc;
    var y1 = y + 0.5;
    var y2 = y - 0.5;
    var jx1 = x1;
    var jy1;
    if (i < 3) {
	// Wires that connect through from top to bottom.
	var x2 = x + span4Base + (5*(i+1)+j)*wireSpc;
	var y3 = y + (6+20)*wireSpc;
	var y5 = y - (6-20)*wireSpc;
	jy1 = y - spanShort;
	wire_add(WT_SP4V, supernet, x1, y1, x1, y3);
	wire_add(WT_SP4V, supernet, x1, y3, x2, y5);
	wire_add(WT_SP4V, supernet, x2, y5, x2, y2);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else if (i == 3) {
	// Wires that terminate at the top of the IO cell.
	var y6 = jy1 = y - spanShort;
	wire_add(WT_SP4V, supernet, x1, y1, x1, y6);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y1);
    } else {
	// Wires that originate at the bottom of the IO cell.
	var y7 = jy1 = y + spanShort;
	wire_add(WT_SP4V, supernet, x1, y7, x1, y2);
	if (net != undefined)
	    text_add(TT_SYMBOL_V, net, supernet, x1, y7);
    }

    // Handle wires that go "around the corner".
    if ((x == 0 || x == chipdb.device.width-1) && i <= 3) {
	if (y == 1) {
	    var y8 = (y-1) + span4Base + (5*i+j)*wireSpc;
	    wire_add(WT_SP4H, supernet, x1, y2, x1, y8);
	} else if (y == chipdb.device.height - 2) {
	    var y8 = (y+1) + span4Base + (5*i+j)*wireSpc;
	    wire_add(WT_SP4H, supernet, x1, y1, x1, y8);
	}
    }

    // Draw connections to other spans, if any.
    if (conn) {
	for (var k = 0; k < conn.length; ++k) {
	    var idx = conn[k];
	    var jx2, jy2;

	    if (idx < 200) {
		// SpanV<->sp4h.
		var srci = Math.floor(idx/12);
		var srcj = idx%12;
		jx2 = (x == 0 ? x - spanShort : x + spanShort);
		jy2 = y + span4Base + (13*srci+srcj)*wireSpc;
	    } else if (idx >= 1000 && idx < 1200) {
		// IO pad input pin -> io spanv.
		var pad = Math.floor((idx - 1000)/2);
		var pin = (idx - 1000)%2;
		var coords = getIOPinCoords(x, y, true, pad, pin);
		jx2 = coords[1];
		jy2 = coords[3];
	    } else if (idx >= 1400 && idx < 1600) {
		// io spanv<->io spanv.
		var srci = Math.floor((idx-1400)/4);
		var srcj = (idx-1400)%4;
		if (srci <= 3) {
		    jx2 = x + span4Base + (5*srci+j)*wireSpc;
		    jy2 = y - spanShort;
		} else {
		    jx2 = x + span4Base + (5*(srci-4)+j)*wireSpc;
		    jy2 = y + spanShort;
		}
	    } else {
		throw "Unexpected src idx " + idx.toString() + " connected to spanv.";
	    }
	    junction_add(WT_SPSP, supernet, jx1, jy1);
	    junction_add(WT_SPSP, supernet, jx2, jy2);
	    wire_add(WT_SPSP, supernet, jx1, jy1, jx2, jy2);
	}
    }
}


var gfx_lcinp_len = 0.1;

function calcOneLutInput(x, y, i, j, net, supernet, conn) {
    var x1 = x + gfx_lc_base;
    var x2 = x1 - gfx_lcinp_len;
    var y1 = y+(i-3.5)*(2*tileEdge)/8 - (3-j-1.5)*(gfx_lc_h/5);
    wire_add(WT_LUTIN, supernet, x1, y1, x2, y1);
    if (net != undefined)
	text_add(TT_SYMBOL_H, net, supernet, x2, y1);

    if (conn != undefined && conn >= 0) {
	if (conn < 32) {
	    // Local net.
	    var conn_i = Math.floor(conn/4);
	    var conn_j = conn%4;
	    var junction_idx =
		local_junction_idx[conn_j+4*(conn_i+8*(x+chipdb.device.width*y))];
	    if (junction_idx >= 0) {
		var x3 = junction_coords[2*junction_idx];
		var y3 = junction_coords[2*junction_idx+1];
		junction_add(WT_LOCAL, supernet, x2, y1);
		wire_add(WT_LOCAL, supernet, x2, y1, x3, y3);
	    }
	} else if (conn <= 38) {
	    // LUT cascade.
	    // ToDo: Test this, my first test .asc did not contain any
	    // LUT cascades...
	    var cascadeLut = (conn - 32);
	    var x3 = x + (gfx_lc_base + gfx_lc_w + gfx_lcdff_base)/2;
	    var y3 = y + (cascadeLut-3.5)*(2*tileEdge)/8;
	    junction_add(WT_LOCAL, supernet, x2, y1);
	    wire_add(WT_LOCAL, supernet, x2, y1, x3, y3);
	    junction_add(WT_LOCAL, supernet, x3, y3);
	} else if (conn <= 46) {
	    // Carry-out from previous LUT.
	    var x3 = x + gfx_lc_base + 0.25*gfx_lc_w;
	    var y3 = y + (i-1-3)*(2*tileEdge)/8;
	    junction_add(WT_LOCAL, supernet, x2, y1);
	    wire_add(WT_LOCAL, supernet, x2, y1, x3, y3);
	    junction_add(WT_LOCAL, supernet, x3, y3);
	} else if (conn == 48 && g_tiles[y][x].carry_in_mux) {
	    // Carry-in mux.
	    var x3 = x + gfx_lc_base + 0.25*gfx_lc_w;
	    var y3 = y - 1 + (7-2.5)*(2*tileEdge)/8 - gfx_lc_h/2;
	    junction_add(WT_LOCAL, supernet, x2, y1);
	    wire_add(WT_LOCAL, supernet, x2, y1, x3, y3);
	    junction_add(WT_LOCAL, supernet, x3, y3);
	}
    }

    lut_input_drive[i+8*(x+chipdb.device.width*y)] |= (1<<j);
}


var gfx_ioou_len = 0.1;
var gfx_ioou_en_len = 0.025;

// Calculate coords for drawing IO input/output pin j on pad i.
// Returns [x1, x2, y1, y2, t_x, t_y, text_dir]
// Pin goes from (x1,y1) on the pad to (x2,y2) for connecting to other net.
// Text to name the net goes at (t_x, t_y), direction text_dir (TT_SYMBOL_[HV]).
function getIOPinCoords(x, y, is_in, i, j) {
    var x1, x2, y1, y2, t_x, t_y;
    var text_dir;
    var pin_delta = gfx_iopad_sz/8*(1+2*j + (is_in ? -4 : 0));

    if (y == 0) {
	t_x = x1 = x2 = x + (i-0.5)*tileEdge + pin_delta;
	y1 = y + gfx_iopad_base + gfx_iopad_sz;
	t_y = y2 = y1 + gfx_ioou_len;
	text_dir = TT_SYMBOL_V;
    } else if (y == chipdb.device.height-1) {
	t_x = x1 = x2 = x + (i-0.5)*tileEdge + pin_delta;
	t_y = y1 = y - gfx_iopad_base - gfx_iopad_sz;
	y2 = y1 - gfx_ioou_len;
	text_dir = TT_SYMBOL_V;
    } else if (x == 0) {
	t_x = x1 = x + gfx_iopad_base + gfx_iopad_sz;
	x2 = x1 + gfx_ioou_len;
	t_y = y1 = y2 = y + (i-0.5)*tileEdge + pin_delta;
	text_dir = TT_SYMBOL_H;
    } else if (x == chipdb.device.width-1) {
	x1 = x - gfx_iopad_base - gfx_iopad_sz;
	t_x = x2 = x1 - gfx_ioou_len;
	t_y = y1 = y2 = y + (i-0.5)*tileEdge + pin_delta;
	text_dir = TT_SYMBOL_H;
    }

    return [x1, x2, y1, y2, t_x, t_y, text_dir];
}


// Calculate coords for drawing IO enable pin on pad i.
// Returns [x1, x2, y1, y2, t_x, t_y, text_dir]
// Pin goes from (x1,y1) on the pad to (x2,y2) for connecting to other net.
// Text to name the net goes at (t_x, t_y), direction text_dir (TT_SYMBOL_[HV]).
function getIOENBCoords(x, y, i) {
    var x1, x2, y1, y2, t_x, t_y;
    var text_dir;

    if (y == 0) {
	t_x = x1 = x + (i-0.5)*tileEdge + 0.5*gfx_iopad_sz;
	x2 = x1 + gfx_ioou_en_len;
	t_y = y1 = y2 = y + gfx_iopad_base + 0.5*gfx_iopad_sz;
	text_dir = TT_SYMBOL_H;
    } else if (y == chipdb.device.height-1) {
	t_x = x1 = x + (i-0.5)*tileEdge + 0.5*gfx_iopad_sz;
	x2 = x1 + gfx_ioou_en_len;
	t_y = y1 = y2 = y - gfx_iopad_base - 0.5*gfx_iopad_sz;
	text_dir = TT_SYMBOL_H;
    } else if (x == 0) {
	t_x = x1 = x2 = x + gfx_iopad_base + 0.5*gfx_iopad_sz;
	y1 = y + (i-0.5)*tileEdge + 0.5*gfx_iopad_sz;
	t_y = y2 = y1 + gfx_ioou_en_len;
	text_dir = TT_SYMBOL_V;
    } else if (x == chipdb.device.width-1) {
	t_x = x1 = x2 = x - gfx_iopad_base - 0.5*gfx_iopad_sz;
	y1 = y + (i-0.5)*tileEdge + 0.5*gfx_iopad_sz;
	t_y = y2 = y1 + gfx_ioou_en_len;
	text_dir = TT_SYMBOL_V;
    }

    return [x1, x2, y1, y2, t_x, t_y, text_dir];
}


function calcOneIOOut(x, y, i, j, net, supernet, conn) {
    var coords;

    if (j < 2) {
	// D_OUT_[01] pin.
	coords = getIOPinCoords(x, y, false, i, j)
    } else {
	// OUT_ENB pin.
	coords = getIOENBCoords(x, y, i);
    }
    var x1 = coords[0];
    var x2 = coords[1];
    var y1 = coords[2];
    var y2 = coords[3];
    var t_x = coords[4];
    var t_y = coords[5];
    var text_dir = coords[6];

    wire_add(WT_IOOU, supernet, x1, y1, x2, y2);
    if (net != undefined)
	text_add(text_dir, net, supernet, t_x, t_y);

    if (conn != undefined && conn >= 0) {
	if (conn < 32) {
	    // Local net.
	    var conn_i = Math.floor(conn/4);
	    var conn_j = conn%4;
	    var junction_idx =
		local_junction_idx[conn_j+4*(conn_i+8*(x+chipdb.device.width*y))];
	    if (junction_idx >= 0) {
		var x3 = junction_coords[2*junction_idx];
		var y3 = junction_coords[2*junction_idx+1];
		junction_add(WT_LOCAL, supernet, x2, y2);
		wire_add(WT_LOCAL, supernet, x2, y2, x3, y3);
	    }
	} else
	    throw "Unexpected connection " + conn + " to IO OUT pin";
    }
}


var gfx_neigh_deltax = [0, -1, 0, 1, -1, 1, -1, 0, 1];
var gfx_neigh_deltay = [0, -1, -1, -1, 0, 0, 1, 1, 1];

// Get the coordinates of the connection point to a local net of a LUT
// output or IO pad input pin.
function getNeighPinCoords(x, y, conn) {
    var dx = gfx_neigh_deltax[Math.floor((conn-800)/8)];
    var dy = gfx_neigh_deltay[Math.floor((conn-800)/8)];
    var neigh_x = x + dx;
    var neigh_y = y + dy;
    if (neigh_x == 0 || neigh_x == chipdb.device.width-1 ||
	neigh_y == 0 || neigh_y == chipdb.device.height-1) {
	// IO pad input pin.
	var pad = Math.floor((conn - 800)/2) % 2;
	var pin = (conn - 800) % 2;
	var coords = getIOPinCoords(neigh_x, neigh_y, true, pad, pin);
	return [coords[1], coords[3]];
    } else {
	// LUT output from this or a neighbour tile.
	var lut = (conn - 800) % 8;
	var x1 = x + dx + gfx_lc_base + gfx_lc_w + gfx_lcout_sz;
	var y1 = y + dy + (lut-3.5)*(2*tileEdge)/8;
	return [x1, y1];
    }
}


function calcOneLocal(x, y, i, j, net, supernet, conn) {
    var x1, y1;

    if (conn < 0)
	return;
    if (conn < 200) {
	// Sp4h.
	var spi = Math.floor(conn/12);
	var spj = conn % 12;
	if (spi < 4) {
	    x1 = x - tileEdge;
	    y1 = y + span4Base + (13*spi+spj)*wireSpc;
	} else {
	    x1 = x + tileEdge;
	    y1 = y + span4Base + spj*wireSpc;
	}
    } else if (conn < 400) {
	// Sp4v.
	var spi = Math.floor((conn-200)/12);
	var spj = (conn - 200) % 12;
	if (spi < 4) {
	    x1 = x + span4Base + (13*spi+spj)*wireSpc;
	    y1 = y + tileEdge;
	} else if (spi == 4) {
	    // Connection on bottom that originates in this tile.
	    x1 = x + span4Base + (spj)*wireSpc;
	    y1 = y - tileEdge;
	} else {
	    // Connection to the span4v of the tile column on the right of this tile.
	    x1 = x + tileEdge;
	    y1 = y + span4Base + (13*(spi-5)+spj-0.5)*wireSpc;
	}
    } else if (conn < 600) {
	// Sp12h.
	var spi = Math.floor((conn-400)/2);
	var spj = (conn-400) % 2;
	if (spi < 12) {
	    x1 = x - tileEdge;
	    y1 = y + span12Base + (2*spi+spj)*wireSpc;
	} else {
	    x1 = x + tileEdge;
	    y1 = y + span12Base + spj*wireSpc;
	}
    } else if (conn < 800) {
	// Sp12v.
	var spi = Math.floor((conn-600)/2);
	var spj = (conn-600) % 2;
	if (spi < 12) {
	    x1 = x + span12Base + (2*spi+spj)*wireSpc;
	    y1 = y + tileEdge;
	} else {
	    x1 = x + span12Base + spj*wireSpc;
	    y1 = y - tileEdge;
	}
    } else if (conn < 1000) {
	var coords = getNeighPinCoords(x, y, conn);
	x1 = coords[0];
	y1 = coords[1];
    } else if  (conn < 1200) {
	// ToDo: glb2local.
	return;
    } else {
	// ToDo: IO tiles, maybe bram tiles...
	throw "Unexpected connection index " + conn.toString() + " for local net";
    }
    var junctionId = junction_add(WT_LOCAL, supernet, x1, y1);
    local_junction_idx[j+4*(i+8*(x+chipdb.device.width*y))] = junctionId;
}


function calcOneIOLocal(x, y, i, j, net, supernet, conn) {
    var x1, y1;

    if (conn < 0)
	return;
    if (conn < 200) {
	// Sp4h.
	var spi = Math.floor(conn/12);
	var spj = conn % 12;
	if (x == 0) {
	    x1 = x + tileEdge;
	} else {
	    x1 = x - tileEdge;
	}
	y1 = y + span4Base + (13*spi+spj)*wireSpc;
    } else if (conn < 400) {
	// Sp4v.
	var spi = Math.floor((conn-200)/12);
	var spj = (conn - 200) % 12;
	x1 = x + span4Base + (13*spi+spj)*wireSpc;
	if (y == 0) {
	    y1 = y + tileEdge;
	} else {
	    y1 = y - tileEdge;
	}
    } else if (conn < 600) {
	// Sp12h.
	var spi = Math.floor((conn-400)/12);
	var spj = (conn-400) % 12;
	if (x == 0) {
	    x1 = x + tileEdge;
	} else {
	    x1 = x - tileEdge;
	}
	y1 = y + span12Base + (12*spi+spj)*wireSpc;
    } else if (conn < 800) {
	// Sp12v.
	var spi = Math.floor((conn-600)/12);
	var spj = (conn-600) % 12;
	x1 = x + span12Base + (12*spi+spj)*wireSpc;
	if (y == 0) {
	    y1 = y + tileEdge;
	} else {
	    y1 = y - tileEdge;
	}
    } else if (conn < 1000) {
	var coords = getNeighPinCoords(x, y, conn);
	x1 = coords[0];
	y1 = coords[1];
    } else if  (conn < 1200) {
	// ToDo: glb2local.
	return;
    } else if (conn < 1400) {
	// IO SpanH.
	var spi = Math.floor((conn-1200)/4);
	var spj = (conn-1200) % 4;
	if (spi < 4) {
	    x1 = x - tileEdge;
	    y1 = y + span4Base + (5*spi+spj)*wireSpc
	} else {
	    x1 = x + tileEdge;
	    y1 = y + span4Base + spj*wireSpc
	}
    } else if (conn < 1600) {
	// IO SpanV.
	var spi = Math.floor((conn-1400)/4);
	var spj = (conn-1400) % 4;
	if (spi < 4) {
	    x1 = x + span4Base + (5*spi+spj)*wireSpc
	    y1 = y + tileEdge;
	} else {
	    x1 = x + span4Base + spj*wireSpc
	    y1 = y - tileEdge;
	}
    } else {
	throw "Unexpected connection index " + conn.toString() + " for IO local net";
    }
    var junctionId = junction_add(WT_LOCAL, supernet, x1, y1);
    local_junction_idx[j+4*(i+8*(x+chipdb.device.width*y))] = junctionId;
}


var gfx_lcout_sz = 0.47 * tileEdge;

function calcOneLutLCOut(x, y, tile, i, lout_net, lcout_net) {
    var x1 = x + gfx_lc_base + gfx_lc_w;
    var x2 = x + gfx_lcdff_base;
    var x3 = x2 + gfx_lcdff_w;
    var x4 = x1 + gfx_lcout_sz;
    var y1 = y + (i-3.5)*(2*tileEdge)/8;

    var bitIndexes = chipdb.logic_tile_bits.function["LC_" + i.toString()];
    var dffEnable = get_bit(tile.config_bits, bitIndexes[9]) != 0;
    var lcout_supernet = net2super(lcout_net);
    if (dffEnable) {
	// When DFF is enabled, show the lout net into the flip-flop, and
	// the lcout net out of the flip-flop.
	var lout_supernet = net2super(lout_net);
	wire_add(WT_LUTLCOUT, lout_supernet, x1, y1, x2, y1);
	wire_add(WT_LUTLCOUT, lcout_supernet, x3, y1, x4, y1);
	if (lcout_net != undefined)
	    text_add(TT_SYMBOL_H, lcout_net, lcout_supernet, x3, y1);
    } else {
	// When DFF is not enabled, a single wire output from LUT is shown.
	wire_add(WT_LUTLCOUT, lcout_supernet, x1, y1, x4, y1);
	if (lcout_net != undefined)
	    text_add(TT_SYMBOL_H, lcout_net, lcout_supernet, x1, y1);
    }
}


function calcOneLutCarry(x, y, i, net) {
    var x1 = x + gfx_lc_base + 0.25*gfx_lc_w;
    var y1 = y + (i-3.5)*(2*tileEdge)/8 + gfx_lc_h/2;
    var y2 = y + (i-2.5)*(2*tileEdge)/8 - gfx_lc_h/2;
    var supernet = net2super(net);
    wire_add(WT_LUTCOUT, supernet, x1, y1, x1, y2);
}


var gfx_ioin_len = gfx_ioou_len;

function calcOneIOIn(x, y, tile, i, j, net) {
    var x1, x2, y1, y2, t_x, t_y;
    var text_dir;

    var coords = getIOPinCoords(x, y, true, i, j);
    var supernet = net2super(net);
    wire_add(WT_IOOU, supernet, coords[0], coords[2], coords[1], coords[3]);

    if (net != undefined)
	text_add(coords[6], net, supernet, coords[4], coords[5]);
}


function calcTilesSpan(x, y, tile, major, minor, calcOneFn, spanKind) {
    var i, j;

    var tile = g_tiles[y][x];
    var nets = tile.nets;
    for (var key in nets) {
	var net = parseInt(key);
	var netdata = nets[key];
	if (netdata.kind == spanKind) {
	    var idx = netdata.index;
	    var sup = net2super(net);
	    var conn = netdata.conn;
	    calcOneFn(x, y, Math.floor(idx/minor), idx%minor, net, sup, conn);
	}
    }
}


function calcTileWires(x, y, tile) {
    if (tile.typ == 'io') {
	calcTilesSpan(x, y, tile, 8, 4, calcOneIOLocal, "loc");
	if (x == 0 || x == chipdb.device.width-1) {
	    calcTilesSpan(x, y, tile, 4, 12, calcOneIOSpan4H, "sp4h");
	    calcTilesSpan(x, y, tile, 2, 12, calcOneIOSpan12H, "sp12h");
	    calcTilesSpan(x, y, tile, 4, 4, calcOneIOSpanV, "iosp4");
	} else {
	    calcTilesSpan(x, y, tile, 4, 12, calcOneIOSpan4V, "sp4v");
	    calcTilesSpan(x, y, tile, 2, 12, calcOneIOSpan12V, "sp12v");
	    calcTilesSpan(x, y, tile, 4, 4, calcOneIOSpanH, "iosp4");
	}
	calcTilesSpan(x, y, tile, 2, 3, calcOneIOOut, "ioou");
	for (var i = 0; i < 2; ++i) {
	    for (var j = 0; j < 2; ++j) {
		var idx = j+2*i+4*(x+chipdb.device.width*y);
		if (g_active_ioin_pins[idx])
		    calcOneIOIn(x, y, tile, i, j, chipdb.cells.ioin[idx]);
	    }
	}
    } else {
	calcTilesSpan(x, y, tile, 8, 4, calcOneLocal, "loc");
	calcTilesSpan(x, y, tile, 5, 12, calcOneSpan4H, "sp4h");
	calcTilesSpan(x, y, tile, 13, 2, calcOneSpan12H, "sp12h");
	calcTilesSpan(x, y, tile, 9, 12, calcOneSpan4V, "sp4v");
	calcTilesSpan(x, y, tile, 13, 2, calcOneSpan12V, "sp12v");
	calcTilesSpan(x, y, tile, 8, 4, calcOneLutInput, "lcin");
	if (tile.typ == 'logic') {
	    for (var i = 0; i < 8; ++i) {
		var idx = i+8*(x+chipdb.device.width*y);
		if (tile.luts[i].active)
		    calcOneLutLCOut(x, y, tile, i, chipdb.cells.lout[idx],
				    chipdb.cells.lcout[idx]);
		if (tile.luts[i].ce)
		    calcOneLutCarry(x, y, i, chipdb.cells.cout[idx]);
	    }
	}
    }
}


function calcTiles(ts) {
    var x, y;
    var width = chipdb.device.width;
    var height = chipdb.device.height;

    gfx_init();

    for (y = 0; y < height; ++y) {
	for (x = 0; x < width; ++x) {
	    if (!(y in ts) || !(x in ts[y]))
		continue;
	    var tile = ts[y][x];
	    tile_wire_idx[2*(y*width+x)] = wire_count;
	    tile_junction_idx[2*(y*width+x)] = junction_count;
	    tile_text_idx[2*(y*width+x)] = text_count;
	    calcTileWires(x, y, tile);
	    tile_wire_idx[2*(y*width+x)+1] = wire_count;
	    tile_junction_idx[2*(y*width+x)+1] = junction_count;
	    tile_text_idx[2*(y*width+x)+1] = text_count;
	}
    }
}


function distPoint2Line(x0, y0, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var l = Math.sqrt(dx*dx + dy*dy);
    if (l < 1e-7) {
	dx = x1 - x0;
	dy = y1 - y0;
	return Math.sqrt(dx*dx + dy*dy);
    }
    return Math.abs(x0*dy - dx*y0 + x2*y1 - x1*y2)/l;
}


// Compute the distance from a point to a line segment. The distance is the
// orthogonal distance to the line segment, if point is within the endpoints
// of the segment; else it is the distance to the closest end-point.
function distPoint2LineSegment(x0, y0, x1, y1, x2, y2) {
    // Vector along the line segment.
    var ax = x2 - x1;
    var ay = y2 - y1;
    // Vector from line segment start to point.
    var bx = x0 - x1;
    var by = y0 - y1;
    // Projection of point onto line.
    var proj = ax*bx + ay*by;
    // Distance to first endpoint if point is before.
    if (proj <= 0)
	return Math.sqrt(bx*bx + by*by);
    // Distance to second endpoint if point is after.
    var a2 = ax*ax + ay*ay;
    if (proj >= a2 || a2 < 1e-10) {
	var cx = x0 - x2;
	var cy = y0 - y2;
	return Math.sqrt(cx*cx + cy*cy);
    }
    // Return distance to line.
    return Math.abs(x0*ay - ax*y0 + x2*y1 - x1*y2)/Math.sqrt(a2);
}


function supernet_to_label(s) {
    var sup = g_supernets[s];
    var txt = "?";
    if (sup != undefined && sup.syms.length > 0) {
	txt = sup.syms[0];
	if (sup.syms.length > 1)
	    txt += "(+)";
    }
    return txt;
}


function getHighlightedNetLabel() {
    var s = highLightSupernet;
    if (s == undefined || s < 0)
	return "";
    return supernet_to_label(s);
}


function checkWireHighlight(base_tx, base_ty, x, y, selectionNum) {
    var width = chipdb.device.width;
    var height = chipdb.device.height;
    // Collect all close-by wire lines.
    // Only consider wires sufficiently close to the mouse position.
    var close_distx = 0.01*(view_x1 - view_x0);
    var close_disty = 0.01*(view_y1 - view_y0);
    var close_dist = (close_distx > close_disty) ? close_distx : close_disty;
    var closeWires = [];

    // We need to consider all wires originating in a 3-by-3 tile
    // configuration, as some wires span two tiles (neigh_op_*_*).
    for (var ty = base_ty - 1; ty <= base_ty + 1; ++ty) {
	if (!(ty in g_tiles))
	    continue;
	for (var tx = base_tx - 1; tx <= base_tx + 1; ++tx) {
	    if (!(tx in g_tiles[ty]))
		continue;
	    var tile = g_tiles[ty][tx];
	    var wire0 = tile_wire_idx[2*(ty*width+tx)];
	    var wire1 = tile_wire_idx[2*(ty*width+tx)+1];
	    for (var i = wire0; i < wire1; ++i) {
		var x0 = wire_coords[i*4];
		var y0 = wire_coords[i*4+1];
		var x1 = wire_coords[i*4+2];
		var y1 = wire_coords[i*4+3];
		var dist = distPoint2LineSegment(x, y, x0, y0, x1, y1);
		if (dist > close_dist)
		    continue;
		closeWires.push({d: dist, i: i});
	    }
	}
    }
    closeWires.sort(function(a, b) { return a.d - b.d; });
    if (closeWires.length > 0)
	return wire_supernets[closeWires[selectionNum % closeWires.length].i];
    else
	return undefined;
}


var gfx_wire_styles = [
    "#00003F",			// WT_SP4H
    "#3F0000",			// WT_SP4V
    "#00003F",			// WT_SP12H
    "#3F0000",			// WT_SP12V
    "#44AAAA",			// WT_SPSP
    "#003377",			// WT_LUTIN
    "#003377",			// WT_LUTCOUT
    "#003377",			// WT_LUTLCOUT
    "#44AAAA",			// WT_LOCAL
    "#003377"			// WT_IOOU
];
//var gfx_high_colours = ["#FF0000", "#FF8D00", "#FFFF00", "#FF8D00"];
var gfx_high_colours = ["#FF0000", "#BB0000", "#770000", "#BB0000"];
var labelStyle = "#000000";

function getWireStyle(wire_type, highlight) {
    if (highlight) {
	var which = Math.floor(Date.now()*.004) % 4;
	return gfx_high_colours[which];
    } else if (wire_type >= WT_SP4H && wire_type <= WT_LOCAL)
	return gfx_wire_styles[wire_type];
    else
	return "#000000";
}


function shouldDraw(wire_type) {
    if (!gfx_drawSpans && wire_type <= WT_SPSP)
	return false;
    if (!gfx_drawLocals && wire_type >= WT_LOCAL)
	return false;
    return true;
}


function drawTileWires(canvas, x, y) {
    var c = canvas.getContext("2d");
    var width = chipdb.device.width;
    var height = chipdb.device.height;

    var wire0 = tile_wire_idx[2*(y*width+x)];
    var wire1 = tile_wire_idx[2*(y*width+x)+1];
    var junction0 = tile_junction_idx[2*(y*width+x)];
    var junction1 = tile_junction_idx[2*(y*width+x)+1];
    var text0 = tile_text_idx[2*(y*width+x)];
    var text1 = tile_text_idx[2*(y*width+x)+1];

    // Draw wires.
    var curType = undefined;
    var curHighLight = undefined;
    c.lineWidth = 1;
    for (var i = wire0; i < wire1; ++i) {
	var x0 = wire_coords[i*4];
	var y0 = wire_coords[i*4+1];
	var x1 = wire_coords[i*4+2];
	var y1 = wire_coords[i*4+3];
	var wire_type = wire_types[i];
	if (!shouldDraw(wire_type))
	    continue;
	var wire_supernet = wire_supernets[i];
	var wire_highlight = (wire_supernet >= 0 && wire_supernet == highLightSupernet);
	if (curType == undefined || curType != wire_type ||
	    curHighLight != wire_highlight) {
	    if (curType != undefined)
		c.stroke();
	    c.strokeStyle = getWireStyle(wire_type, wire_highlight);
	    c.lineWidth = wire_highlight ? 3 : 1;
	    c.beginPath();
	    curType = wire_type;
	    curHighLight = wire_highlight;
	}
	worldMoveTo(canvas, c, x0, y0);
	worldLineTo(canvas, c, x1, y1);
    }
    if (curType != undefined)
	c.stroke();

    // Draw junctions.
    curType = undefined;
    curHighLight = undefined;
    var oldCap;
    for (var i = junction0; i < junction1; ++i) {
	var x0 = junction_coords[2*i];
	var y0 = junction_coords[2*i+1];
	var junction_type = junction_types[i];
	if (!shouldDraw(junction_type))
	    continue;
	var junction_supernet = junction_supernets[i];
	var junction_highlight =
	    (junction_supernet >= 0 && junction_supernet == highLightSupernet);
	if (curType = undefined || curType != junction_type ||
	   curHighLight != junction_highlight) {
	    if (curType != undefined)
		c.stroke();
	    else
		oldCap = c.lineCap;
	    c.strokeStyle = getWireStyle(junction_type, junction_highlight);
	    c.lineWidth = 5;
	    c.lineCap = "round";
	    c.beginPath();
	    curType = junction_type;
	    curHighLight = junction_highlight;
	}
	worldMoveTo(canvas, c, x0, y0);
	worldLineTo(canvas, c, x0, y0);
    }
    if (curType != undefined) {
	c.stroke();
	c.lineCap = oldCap;
    }

    // Draw labels.
    curType = undefined;
    c.strokeStyle = labelStyle;
    var doLabels;
    for (var i = text0; i < text1; ++i) {
	var x0 = text_coords[2*i];
	var y0 = text_coords[2*i+1];
	var net = text_nets[i];
	var supernet = text_supernets[i];
	var text_type = text_types[i];
	if (curType == undefined || curType != text_type) {
	    // Adaptive font size
	    var size = (text_type == TT_SYMBOL_H) ?
		wireSpc/(view_y1-view_y0)*canvas.height :
		wireSpc/(view_x1-view_x0)*canvas.width;
	    size = Math.floor(0.9*size);
	    if (size < 8)
		doLabels = false;
	    else {
		if (size > 30)
		    size = 25;
		c.font = size.toString() + "px Arial";
		doLabels = true;
		c.fillStyle = c.strokeStyle;
	    }
	    c.lineWidth = 1;
	    curType = text_type;
	}
	if (doLabels) {
	    var label = net.toString();
	    if (supernet >= 0) {
		var sup = g_supernets[supernet];
		if (sup.syms.length > 0) {
		    if (gfx_showNetNumbers)
			label += ": " + sup.syms[0];
		    else
			label = sup.syms[0];
		    if (sup.syms.length > 1)
			label += "(+)";
		}
	    }
	    if (curType == TT_SYMBOL_H)
		worldHFillText(canvas, c, label, x0, y0, labelMax);
	    else
		worldVFillText(canvas, c, label, x0, y0, labelMax);
	}
    }
}


function iopad_min_tile_pixels() {
    return detailLevelFactor*100;
}


function lut_min_tile_pixels() {
    return detailLevelFactor*175;
}


var gfx_lc_base = -tileEdge+0.337;
var gfx_lc_w = 0.54*tileEdge;
var gfx_lc_h = 0.82*2*tileEdge/8;
var gfx_lcdff_base = gfx_lc_base + gfx_lc_w + 0.04;
var gfx_lcdff_w = 0.05;
var gfx_iopad_base = -tileEdge+0.09;
var gfx_iopad_sz = 0.74*tileEdge;

function drawTileCells(canvas, x, y, tile, tilePixels) {
    var c = canvas.getContext("2d");
    if (tile.typ == "logic" && tilePixels >= lut_min_tile_pixels()) {
	var x1 = x + gfx_lc_base;
	var x2 = x1 + gfx_lc_w
	var txt_wx = x1+0.01;
	var txt_wmax = gfx_lc_w - 0.02;

	c.lineWidth = 5;
	c.strokeStyle = "#333333";
	c.beginPath();
	for (var i = 0; i < 8; ++i) {
	    var x3 = x + gfx_lcdff_base;
	    var x4 = x3 + gfx_lcdff_w;
	    var x5 = x3 + 0.25*gfx_lcdff_w;
	    var x6 = x3 + 0.50*gfx_lcdff_w;
	    var x7 = x3 + 0.75*gfx_lcdff_w;
	    var y0 = y + (i-3.5)*(2*tileEdge)/8;
	    var y1 = y0 - gfx_lc_h/2;
	    var y2 = y0 + gfx_lc_h/2
	    var y3 = y2 - 0.25*gfx_lcdff_w;
	    var txt_wy = y0 - 0.22*gfx_lc_h;

	    var lutData = tile.luts[i];
	    if (!lutData.active)
		continue;
	    var func = lutData.fn;
	    var funcText = getLutTextFunction(func, lut_input_drive[i+8*(x+chipdb.device.width*y)]);
	    worldHFillText(canvas, c, funcText, txt_wx, txt_wy, txt_wmax);
	    worldRect(canvas, x1, y1, x2, y2);
	    if (lutData.dff) {
		worldRect(canvas, x3, y1, x4, y2);
		worldMoveTo(canvas, c, x5, y2);
		worldLineTo(canvas, c, x6, y3);
		worldLineTo(canvas, c, x7, y2);
	    }
	}
	c.stroke();
    } else if (tile.typ == "io" && tilePixels >= iopad_min_tile_pixels()) {
	// ToDo: Omit not used pads.
	c.strokeStyle = "#333333";
	for (var i = 0; i < 2; ++i) {
	    var x1, x2, y1, y2, tri_dir;

	    // Do not draw unused IO pads.
	    if (!g_active_iopad[i+2*(x+chipdb.device.width*y)])
		continue;
	    if (x == 0) {
		x1 = x + gfx_iopad_base;
		x2 = x1 + gfx_iopad_sz;
		y1 = y + (i-0.5)*tileEdge - gfx_iopad_sz/2;
		y2 = y + (i-0.5)*tileEdge + gfx_iopad_sz/2;
		tri_dir = -1;
	    } else if (x == chipdb.device.width-1) {
		x1 = x - gfx_iopad_base;
		x2 = x1 - gfx_iopad_sz;
		y1 = y + (i-0.5)*tileEdge - gfx_iopad_sz/2;
		y2 = y + (i-0.5)*tileEdge + gfx_iopad_sz/2;
		tri_dir = 1;
	    } else if (y == 0) {
		x1 = x + (i-0.5)*tileEdge - gfx_iopad_sz/2;
		x2 = x + (i-0.5)*tileEdge + gfx_iopad_sz/2;
		y1 = y + gfx_iopad_base;
		y2 = y1 + gfx_iopad_sz;
		tri_dir = -1;
	    } else if (y == chipdb.device.height-1) {
		x1 = x + (i-0.5)*tileEdge - gfx_iopad_sz/2;
		x2 = x + (i-0.5)*tileEdge + gfx_iopad_sz/2;
		y1 = y - gfx_iopad_base;
		y2 = y1 - gfx_iopad_sz;
		tri_dir = 1;
	    }

	    c.lineWidth = 7;
	    c.beginPath();
	    worldRect(canvas, x1, y1, x2, y2);
	    worldMoveTo(canvas, c, x1, y1);
	    worldLineTo(canvas, c, x2, y2);
	    worldMoveTo(canvas, c, x1, y2);
	    worldLineTo(canvas, c, x2, y1);
	    c.stroke();

	    c.fillStyle = "#000000";
	    if (x == 0 || x == chipdb.device.width-1) {
		for (var j = 0; j < 4; ++j) {
		    var m = y1 + (y2-y1)*(2*j+1)/8;
		    var m1 = m - gfx_iopad_sz/8*0.63;
		    var m2 = m + gfx_iopad_sz/8*0.63;
		    var l = x2 + gfx_iopad_sz/8*0.57*(j < 2 ? -tri_dir : tri_dir);
		    worldFilledPoly(canvas, c, [x2, m1, l, m, x2, m2]);
		}
	    } else {
		for (var j = 0; j < 4; ++j) {
		    var m = x1 + (x2-x1)*(2*j+1)/8;
		    var m1 = m - gfx_iopad_sz/8*0.63;
		    var m2 = m + gfx_iopad_sz/8*0.63;
		    var h = y2 + gfx_iopad_sz/8*0.57*(j < 2 ? -tri_dir : tri_dir);
		    worldFilledPoly(canvas, c, [m1, y2, m, h, m2, y2]);
		}
	    }
	}
    }
}


function wire_min_tile_pixels() {
    return detailLevelFactor*(drawAll ? 150 : 80);
}


function get_tile_pixels(width, height) {
    return 0.5*(width/(view_x1 - view_x0) + height/(view_y1 - view_y0));
}


function drawTiles(canvas, showNetNumbers, drawSpans, drawLocals) {
    var c = canvas.getContext("2d");
    var x0 = Math.floor(view_x0 - 0.5);
    var x1 = Math.ceil(view_x1 + 0.5);
    var y0 = Math.floor(view_y0 - 0.5);
    var y1 = Math.ceil(view_y1 + 0.5);
    if (x0 < 0)
	x0 = 0;
    if (x1 >= chipdb.device.width)
	x1 = chipdb.device.width;
    if (y0 < 0)
	y0 = 0;
    if (y1 >= chipdb.device.height)
	y1 = chipdb.device.height;

    var x, y;
    var width = canvas.width;
    var height = canvas.height;

    // Depending on how many pixels per tile (zoom level), we draw
    // with different level of detail.
    var tile_pixels = get_tile_pixels(width, height);

    gfx_showNetNumbers = showNetNumbers;
    gfx_drawSpans = drawSpans;
    gfx_drawLocals = drawLocals;

    // Draw tile backgrounds.
    for (y = y0; y < y1; ++y) {
	for (x = x0; x < x1; ++x) {
	    if (!(y in g_tiles) || !(x in g_tiles[y]))
		continue;
	    var tile = g_tiles[y][x];
	    var col = tileCol(tile.typ, tile.active);
	    c.fillStyle = col;
	    worldFillRect(canvas, x-tileEdge, y-tileEdge, x+tileEdge, y+tileEdge);
	}
    }

    // Draw tile wires and conteng_tiles.
    var min_tile_pixels = wire_min_tile_pixels();
    for (y = y0; y < y1; ++y) {
	for (x = x0; x < x1; ++x) {
	    if (!(y in g_tiles) || !(x in g_tiles[y]))
		continue;
	    var tile = g_tiles[y][x];

	    // Label the tile.
	    var size = Math.floor(0.05/(view_y1-view_y0)*canvas.height);
	    if (size < 8 && size >= 2)
		size = 8;
	    c.font = size.toString() + "px Arial";
	    c.fillStyle = "#000000";
	    var label = "(" + x.toString() + " " + y.toString() + ")";
	    worldHFillText(canvas, c, label, x-tileEdge, y+tileEdge);

	    drawTileCells(canvas, x, y, tile, tile_pixels);

	    if (tile_pixels >= min_tile_pixels)
		drawTileWires(canvas, x, y, tile, chipdb);
	}
    }
}
