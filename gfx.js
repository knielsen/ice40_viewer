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
    return [cx, cy];
}


function worldFillRect(canvas, wx0, wy0, wx1, wy1) {
    var a = world2canvas(canvas, wx0, wy1);
    var b = world2canvas(canvas, wx1, wy0);
    canvas.getContext("2d").fillRect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
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

function drawOneSpan4H(canvas, c, x, y, i, j, label) {
    if (i < 3) {
	// Crossed-over wires.
	c.beginPath();
	worldMoveTo(canvas, c, x - 0.5, y+span4Base + (13*i+j)*wireSpc);
	if ((j % 2) == 0) {
	    worldLineTo(canvas, c, x - (7-20)*wireSpc, y+span4Base + (13*i+j)*wireSpc);
	    worldLineTo(canvas, c, x + (6+20)*wireSpc, y+span4Base + (13*(i+1)+j+1)*wireSpc);
	    worldLineTo(canvas, c, x + 0.5, y+span4Base + (13*(i+1)+j+1)*wireSpc);
	} else {
	    worldLineTo(canvas, c, x - (5-20)*wireSpc, y+span4Base + (13*i+j)*wireSpc);
	    worldLineTo(canvas, c, x + (6+20)*wireSpc, y+span4Base + (13*(i+1)+j-1)*wireSpc);
	    worldLineTo(canvas, c, x + 0.5, y+span4Base + (13*(i+1)+j-1)*wireSpc);
	}
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - 0.5, y+span4Base + (13*i+j)*wireSpc, labelMax);
    } else if (i == 3) {
	// Connection on left that terminate in this tile.
	c.beginPath();
	worldMoveTo(canvas, c, x - 0.5, y+span4Base + (13*i+j)*wireSpc);
	worldLineTo(canvas, c, x + spanShort, y + span4Base + (13*3+j)*wireSpc);
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - 0.5, y+span4Base + (13*i+j)*wireSpc, labelMax);
    } else if (i == 4) {
	// Connection on bottom that originates in this tile.
	c.beginPath();
	worldMoveTo(canvas, c, x - spanShort, y + span4Base + j*wireSpc);
	worldLineTo(canvas, c, x + 0.5, y + span4Base + j*wireSpc);
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - spanShort, y + span4Base + j*wireSpc, labelMax);
    }
    else throw "Invalid span index for drawOneSpan4H: " + i.toString();
}


function drawOneSpan12H(canvas, c, x, y, i, j, label) {
    if (i < 11) {
	c.beginPath();
	worldMoveTo(canvas, c, x - 0.5, y+span12Base + (2*i+j)*wireSpc);
	if ((j % 2) == 0) {
	    worldLineTo(canvas, c, x - 2*wireSpc, y+span12Base + (2*i+j)*wireSpc);
	    worldLineTo(canvas, c, x + 1*wireSpc, y+span12Base + (2*(i+1)+j+1)*wireSpc);
	    worldLineTo(canvas, c, x + 0.5, y+span12Base + (2*(i+1)+j+1)*wireSpc);
	} else {
	    worldLineTo(canvas, c, x - 0*wireSpc, y+span12Base + (2*i+j)*wireSpc);
	    worldLineTo(canvas, c, x + 1*wireSpc, y+span12Base + (2*(i+1)+j-1)*wireSpc);
	    worldLineTo(canvas, c, x + 0.5, y+span12Base + (2*(i+1)+j-1)*wireSpc);
	}
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - 0.5, y+span12Base + (2*i+j)*wireSpc, labelMax);
    } else if (i == 11) {
	c.beginPath();
	worldMoveTo(canvas, c, x - 0.5, y+span12Base + (2*i+j)*wireSpc);
	worldLineTo(canvas, c, x + spanShort, y + span12Base + (2*11+j)*wireSpc);
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - 0.5, y+span12Base + (2*i+j)*wireSpc, labelMax);
    } else if (i == 12) {
	c.beginPath();
	worldMoveTo(canvas, c, x - spanShort, y + span12Base + j*wireSpc);
	worldLineTo(canvas, c, x + 0.5, y + span12Base + j*wireSpc);
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x - spanShort, y + span12Base + j*wireSpc, labelMax);
    }
    else throw "Invalid span index for drawOneSpan12H: " + i.toString();
}


function drawOneSpan4V(canvas, c, x, y, i, j, label) {
    c.lineWidth = 1;
    if (i < 3) {
	c.beginPath();
	// Crossed-over wires.
	worldMoveTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + 0.5);
	if ((j % 2) == 0) {
	    worldLineTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + (7+20)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc, y - (6-20)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc, y - 0.5);
	    // Connection to the tile on the left.
	    worldMoveTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x-0.5, y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    // Draw interconnect dots.
	    c.stroke();
	    c.lineWidth = 5;
	    var oldCap = c.lineCap;
	    c.lineCap = "round";
	    c.beginPath();
	    worldMoveTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    c.stroke();
	    c.lineCap = oldCap;
	} else {
	    worldLineTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + (5+20)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc, y - (6-20)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc, y - 0.5);
	    // Connection to the tile on the left.
	    worldMoveTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x-0.5, y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    // Draw interconnect dots.
	    c.stroke();
	    c.lineWidth = 5;
	    var oldCap = c.lineCap;
	    c.lineCap = "round";
	    c.beginPath();
	    worldMoveTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc,
			y+span4Base + (13*(i+1)+j-0.5)*wireSpc);
	    c.stroke();
	    c.lineCap = oldCap;
	}
	if (label != undefined)
	    worldVFillText(canvas, c, label, x+span4Base + (13*i+j)*wireSpc, y + 0.5, labelMax);
    } else if (i == 3) {
	c.beginPath();
	// Connection on top that terminate in this tile.
	worldMoveTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + 0.5);
	worldLineTo(canvas, c, x + span4Base + (13*3+j)*wireSpc, y - spanShort);
	c.stroke();
	if (label != undefined)
	    worldVFillText(canvas, c, label, x+span4Base + (13*i+j)*wireSpc, y + 0.5, labelMax);
    } else if (i == 4) {
	c.beginPath();
	// Connection on bottom that originates in this tile.
	worldMoveTo(canvas, c, x + span4Base + j*wireSpc, y + spanShort2);
	worldLineTo(canvas, c, x + span4Base + j*wireSpc, y - 0.5);
	// Connection to the tile on the left.
	worldMoveTo(canvas, c, x+span4Base + (13*0+j)*wireSpc,
		    y+span4Base + (13*0+j-0.5)*wireSpc);
	worldLineTo(canvas, c, x-0.5, y+span4Base + (13*0+j-0.5)*wireSpc);
	c.stroke();
	// Draw interconnect dots.
	c.lineWidth = 5;
	var oldCap = c.lineCap;
	c.lineCap = "round";
	c.beginPath();
	worldMoveTo(canvas, c, x+span4Base + (13*0+j)*wireSpc,
		    y+span4Base + (13*0+j-0.5)*wireSpc);
	worldLineTo(canvas, c, x+span4Base + (13*0+j)*wireSpc,
		    y+span4Base + (13*0+j-0.5)*wireSpc);
	c.stroke();
	c.lineCap = oldCap;
	if (label != undefined)
	    worldVFillText(canvas, c, label, x + span4Base + j*wireSpc, y + spanShort2, labelMax);
    } else if (i >= 5) {
	c.beginPath();
	// Connection to the span4v of the tile column on the right of this tile.
	worldMoveTo(canvas, c, x-spanShort-wireSpc, y+span4Base + (13*(i-5)+j-0.5)*wireSpc);
	worldLineTo(canvas, c, x+0.5, y+span4Base + (13*(i-5)+j-0.5)*wireSpc);
	c.stroke();
	if (label != undefined)
	    worldHFillText(canvas, c, label, x-spanShort-wireSpc, y+span4Base + (13*(i-5)+j-0.5)*wireSpc, labelMax);
    }
}


function drawOneSpan12V(canvas, c, x, y, i, j, label) {
    if (i < 11) {
	c.beginPath();
	worldMoveTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 0.5);
	if ((j % 2) == 0) {
	    worldLineTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 2*wireSpc);
	    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j+1)*wireSpc, y - 1*wireSpc);
	    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j+1)*wireSpc, y - 0.5);
	} else {
	    worldLineTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 0*wireSpc);
	    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j-1)*wireSpc, y - 1*wireSpc);
	    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j-1)*wireSpc, y - 0.5);
	}
	c.stroke();
	if (label != undefined)
	    worldVFillText(canvas, c, label, x+span12Base + (2*i+j)*wireSpc, y + 0.5, labelMax);
    } else if (i == 11) {
	c.beginPath();
	worldMoveTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 0.5);
	worldLineTo(canvas, c, x + span12Base + (2*11+j)*wireSpc, y - spanShort);
	c.stroke();
	if (label != undefined)
	    worldVFillText(canvas, c, label, x+span12Base + (2*i+j)*wireSpc, y + 0.5, labelMax);
    } else {
	c.beginPath();
	worldMoveTo(canvas, c, x + span12Base + j*wireSpc, y + spanShort);
	worldLineTo(canvas, c, x + span12Base + j*wireSpc, y - 0.5);
	c.stroke();
	if (label != undefined)
	    worldVFillText(canvas, c, label, x + span12Base + j*wireSpc, y + spanShort, labelMax);
    }
}


function drawTilesSpan(canvas, c, x, y, tile, drawAll,
		       major, minor, drawOneFn, spanKind, colour) {
    var i, j;

    c.strokeStyle = colour;
    c.lineWidth = 1;
    // Adaptive font size
    var size = (spanKind == "sp4h" || spanKind == "sp12h") ?
	wireSpc/(view_y1-view_y0)*canvas.height :
	wireSpc/(view_x1-view_x0)*canvas.width;
    size = Math.floor(0.9*size);
    var doLabels;
    if (size < 8)
	doLabels = false;
    else {
	if (size > 30)
	    size = 25;
	c.font = size.toString() + "px Arial";
	doLabels = true;
	c.fillStyle = c.strokeStyle;
    }
    if (drawAll) {
	for (i = 0; i < major; ++i) {
	    for (j = 0; j < minor; ++j) {
		drawOneFn(canvas, c, x, y, i, j, undefined);
	    }
	}
    } else {
	var tile = g_tiles[y][x];
	var nets = tile.nets;
	for (var k in nets) {
	    var netdata = nets[k];
	    if (netdata.kind == spanKind) {
		var idx = netdata.index;
		var label;
		if (doLabels) {
		    label = k.toString();
		    if (k in g_symtable)
			label += ": " + g_symtable[k];
		} else
		    label = undefined;
		drawOneFn(canvas, c, x, y, Math.floor(idx/minor), idx%minor, label);
	    }
	}
    }
}


function drawTileWires(canvas, x, y, tile, chipdb) {
    var c = canvas.getContext("2d");
    var i, j;

    // ToDo: Maybe better to iterate once here over all nets in all
    // tiles at once, rather than iterating 4 times, each time picking
    // out a specific span variant.
    if (tile.typ != 'io') {
	// ToDo: io tile needs some differences here.
	drawTilesSpan(canvas, c, x, y, tile, false, 5, 12, drawOneSpan4H, "sp4h", "#00003F");
	drawTilesSpan(canvas, c, x, y, tile, false, 9, 12, drawOneSpan4V, "sp4v", "#3F0000");
    }

    if (tile.typ != 'io') {
	drawTilesSpan(canvas, c, x, y, tile, false, 13, 2, drawOneSpan12H, "sp12h", "#00003F");
	drawTilesSpan(canvas, c, x, y, tile, false, 13, 2, drawOneSpan12V, "sp12v", "#3F0000");
    }
}


function drawTiles(canvas, ts, chipdb) {
    var c = canvas.getContext("2d");
    var x0 = Math.floor(view_x0 - 0.5);
    var x1 = Math.ceil(view_x1 + 0.5);
    var y0 = Math.floor(view_y0 - 0.5);
    var y1 = Math.ceil(view_y1 + 0.5);

    var x, y;
    var width = canvas.width;
    var height = canvas.height;

    // Depending on how many pixels per tile (zoom level), we draw
    // with different level of detail.
    var tile_pixels =
	0.5*(canvas.width/(view_x1 - view_x0) + canvas.height/(view_y1 - view_y0));

    for (y = y0; y < y1; ++y) {
	for (x = x0; x < x1; ++x) {
	    if (!(y in ts) || !(x in ts[y]))
		continue;
	    var tile = ts[y][x];
	    var col = tileCol(tile.typ, tile.active);
	    c.fillStyle = col;
	    worldFillRect(canvas, x-tileEdge, y-tileEdge, x+tileEdge, y+tileEdge);

	    // Label the tile.
	    var size = Math.floor(0.05/(view_y1-view_y0)*canvas.height);
	    if (size < 8 && size >= 2)
		size = 8;
	    c.font = size.toString() + "px Arial";
	    c.fillStyle = "#000000";
	    var label = "(" + x.toString() + " " + y.toString() + ")";
	    worldHFillText(canvas, c, label, x-tileEdge, y+tileEdge);

	    if (tile_pixels > 200)
		drawTileWires(canvas, x, y, tile, chipdb);
	}
    }
}
