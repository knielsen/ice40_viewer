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
		// ToDo: some heuristics for the other tile types.
		t.active = true;
		break;
	    }
	}
    }
}
