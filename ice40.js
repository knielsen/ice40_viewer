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
		    t.active = true;
		    // ToDo: not active tile if only span->span buffer.
		    // ToDo... do something with the nets.
		}
	    }
	}
    }
}
