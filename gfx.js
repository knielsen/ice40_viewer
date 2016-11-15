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


var g_dbg;
function drawTiles(canvas, ts, chipdb) {
    var c = canvas.getContext("2d");
    var x0 = Math.floor(view_x0 - 0.5);
    var x1 = Math.ceil(view_x1 + 0.5);
    var y0 = Math.floor(view_y0 - 0.5);
    var y1 = Math.ceil(view_y1 + 0.5);

    var x, y;

    for (y = y0; y < y1; ++y) {
	for (x = x0; x < x1; ++x) {
	    if (!(y in ts) || !(x in ts[y]))
		continue;
	    var tile = ts[y][x];
	    var col = tileCol(tile.typ, tile.active);
	    c.fillStyle = col;
	    worldFillRect(canvas, x-0.4, y-0.4, x+0.4, y+0.4);
	}
    }
}
