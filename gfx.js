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
	    ts[y][x] = { typ: typ };
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


function drawTilesSpan4H(canvas, c, x, y, tile, chipdb) {
    var i, j;

    // Draw horizontal span4's.
    for (i = 0; i < 4; ++i) {
	c.strokeStyle = "#00003F";
	c.lineWidth = 1;
	c.beginPath();

	for (j = 0; j < 12; ++j) {
	    worldMoveTo(canvas, c, x - 0.5, y+span4Base + (13*i+j)*wireSpc);
	    if (i != 3) {
		if ((j % 2) == 0) {
		    worldLineTo(canvas, c, x - (7-20)*wireSpc, y+span4Base + (13*i+j)*wireSpc);
		    worldLineTo(canvas, c, x + (6+20)*wireSpc, y+span4Base + (13*(i+1)+j+1)*wireSpc);
		    worldLineTo(canvas, c, x + 0.5, y+span4Base + (13*(i+1)+j+1)*wireSpc);
		} else {
		    worldLineTo(canvas, c, x - (5-20)*wireSpc, y+span4Base + (13*i+j)*wireSpc);
		    worldLineTo(canvas, c, x + (6+20)*wireSpc, y+span4Base + (13*(i+1)+j-1)*wireSpc);
		    worldLineTo(canvas, c, x + 0.5, y+span4Base + (13*(i+1)+j-1)*wireSpc);
		}
	    } else {
		worldLineTo(canvas, c, x + spanShort, y + span4Base + (13*3+j)*wireSpc);
		worldMoveTo(canvas, c, x - spanShort, y + span4Base + j*wireSpc);
		worldLineTo(canvas, c, x + 0.5, y + span4Base + j*wireSpc);
	    }
	}
	c.stroke();
    }
}


function drawTilesSpan12H(canvas, c, x, y, tile, chipdb) {
    // Draw horizontal span12's.
    for (i = 0; i < 12; ++i) {
	c.strokeStyle = "#00003F";
	c.lineWidth = 1;
	c.beginPath();

	for (j = 0; j < 2; ++j) {
	    worldMoveTo(canvas, c, x - 0.5, y+span12Base + (2*i+j)*wireSpc);
	    if (i != 11) {
		if ((j % 2) == 0) {
		    worldLineTo(canvas, c, x - 2*wireSpc, y+span12Base + (2*i+j)*wireSpc);
		    worldLineTo(canvas, c, x + 1*wireSpc, y+span12Base + (2*(i+1)+j+1)*wireSpc);
		    worldLineTo(canvas, c, x + 0.5, y+span12Base + (2*(i+1)+j+1)*wireSpc);
		} else {
		    worldLineTo(canvas, c, x - 0*wireSpc, y+span12Base + (2*i+j)*wireSpc);
		    worldLineTo(canvas, c, x + 1*wireSpc, y+span12Base + (2*(i+1)+j-1)*wireSpc);
		    worldLineTo(canvas, c, x + 0.5, y+span12Base + (2*(i+1)+j-1)*wireSpc);
		}
	    } else {
		worldLineTo(canvas, c, x + spanShort, y + span12Base + (2*11+j)*wireSpc);
		worldMoveTo(canvas, c, x - spanShort, y + span12Base + j*wireSpc);
		worldLineTo(canvas, c, x + 0.5, y + span12Base + j*wireSpc);
	    }
	}
	c.stroke();
    }
}


function drawTilesSpan4V(canvas, c, x, y, tile, chipdb) {
    var i, j;

    // Draw vertical span4's.
    for (i = 0; i < 4; ++i) {
	c.strokeStyle = "#3F0000";
	c.lineWidth = 1;
	c.beginPath();

	for (j = 0; j < 12; ++j) {
	    worldMoveTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + 0.5);
	    if (i != 3) {
		if ((j % 2) == 0) {
		    worldLineTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + (7+20)*wireSpc);
c.lineWidth = 3;
		    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc, y - (6-20)*wireSpc);
c.lineWidth = 1;
		    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j+1)*wireSpc, y - 0.5);
		} else {
		    worldLineTo(canvas, c, x+span4Base + (13*i+j)*wireSpc, y + (5+20)*wireSpc);
		    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc, y - (6-20)*wireSpc);
		    worldLineTo(canvas, c, x+span4Base + (13*(i+1)+j-1)*wireSpc, y - 0.5);
		}
	    } else {
		worldLineTo(canvas, c, x + span4Base + (13*3+j)*wireSpc, y - spanShort);
		worldMoveTo(canvas, c, x + span4Base + j*wireSpc, y + spanShort2);
		worldLineTo(canvas, c, x + span4Base + j*wireSpc, y - 0.5);
	    }
	    worldMoveTo(canvas, c, x+span4Base + (13*i+j)*wireSpc,
			y+span4Base + (13*i+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x-0.5, y+span4Base + (13*i+j-0.5)*wireSpc);
	    worldMoveTo(canvas, c, x-spanShort-wireSpc, y+span4Base + (13*i+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x+0.5, y+span4Base + (13*i+j-0.5)*wireSpc);
	}
	c.stroke();
    }
    // Draw interconnect dots.
    for (i = 0; i < 4; ++i) {
	c.strokeStyle = "#3F0000";
	c.lineWidth = 5;
	var oldCap = c.lineCap;
	c.lineCap = "round";
	c.beginPath();

	for (j = 0; j < 12; ++j) {
	    worldMoveTo(canvas, c, x+span4Base + (13*i+j)*wireSpc,
			y+span4Base + (13*i+j-0.5)*wireSpc);
	    worldLineTo(canvas, c, x+span4Base + (13*i+j)*wireSpc,
			y+span4Base + (13*i+j-0.5)*wireSpc);
	}
	c.stroke();
	c.lineCap = oldCap;
    }
}


function drawTilesSpan12V(canvas, c, x, y, tile, chipdb) {
    // Draw vertical span12's.
    for (i = 0; i < 12; ++i) {
	c.strokeStyle = "#3F0000";
	c.lineWidth = 1;
	c.beginPath();

	for (j = 0; j < 2; ++j) {
	    worldMoveTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 0.5);
	    if (i != 11) {
		if ((j % 2) == 0) {
		    worldLineTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 2*wireSpc);
		    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j+1)*wireSpc, y - 1*wireSpc);
		    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j+1)*wireSpc, y - 0.5);
		} else {
		    worldLineTo(canvas, c, x+span12Base + (2*i+j)*wireSpc, y + 0*wireSpc);
		    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j-1)*wireSpc, y - 1*wireSpc);
		    worldLineTo(canvas, c, x+span12Base + (2*(i+1)+j-1)*wireSpc, y - 0.5);
		}
	    } else {
		worldLineTo(canvas, c, x + span12Base + (2*11+j)*wireSpc, y - spanShort);
		worldMoveTo(canvas, c, x + span12Base + j*wireSpc, y + spanShort);
		worldLineTo(canvas, c, x + span12Base + j*wireSpc, y - 0.5);
	    }
	}
	c.stroke();
    }
}


function drawTileWires(canvas, x, y, tile, chipdb) {
    var c = canvas.getContext("2d");
    var i, j;

    if (tile.typ != 'io') {
	// ToDo: io tile needs some differences here.
	drawTilesSpan4H(canvas, c, x, y, tile, chipdb);
	drawTilesSpan4V(canvas, c, x, y, tile, chipdb);
    }

    if (tile.typ != 'io') {
	drawTilesSpan12H(canvas, c, x, y, tile, chipdb);
	drawTilesSpan12V(canvas, c, x, y, tile, chipdb);
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
	    if (tile_pixels > 200)
		drawTileWires(canvas, x, y, tile, chipdb);
	}
    }
}
