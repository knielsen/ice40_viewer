parameter DW = 16;
parameter AW = 8;

module pllclk (input ext_clock, output pll_clock, input nrst, output lock);
   wire dummy_out;
   wire bypass, lock1;

   assign bypass = 1'b0;

   // DIVR=0 DIVF=71 DIVQ=3  freq=12/1*72/8 = 108 MHz
   SB_PLL40_CORE #(.FEEDBACK_PATH("SIMPLE"), .PLLOUT_SELECT("GENCLK"),
		   .DIVR(4'd0), .DIVF(7'b1000111), .DIVQ(3'b011),
		   .FILTER_RANGE(3'b001)
   ) mypll1 (.REFERENCECLK(ext_clock),
	    .PLLOUTGLOBAL(pll_clock), .PLLOUTCORE(dummy_out), .LOCK(lock1),
	    .RESETB(nrst), .BYPASS(bypass));

endmodule	    


module dff #(parameter W=1)
   (input wire[W-1:0] D, input clk, output reg[W-1:0] Q);

   always @(posedge clk)
     Q <= D;
endmodule // dff


module synchroniser #(parameter W=1)
   (input wire[W-1:0] D, input clk, output wire[W-1:0] Q);

   wire[W-1:0] M;

   dff #(W) first_reg(D, clk, M);
   dff #(W) last_reg(M, clk, Q);
endmodule 

module clocked_bus_slave #(parameter ADRW=1, DATW=1)
  (input aNE, aNOE, aNWE,
   input wire [ADRW-1:0] aAn, input wire[DATW-1:0] aDn,
   input 		 clk,
   output wire[ADRW-1:0] r_adr, output wire[ADRW-1:0] w_adr,
   output reg 		 do_read, input wire[DATW-1:0] read_data,
   output reg 		 do_write, output reg[DATW-1:0] w_data,
   output 		 io_output, output wire[DATW-1:0] io_data);

   wire sNE, sNOE, sNWE;
   reg[ADRW-1:0] sAn_r;
   reg[ADRW-1:0] sAn_w;
   reg[DATW-1:0] rDn;
   reg[DATW-1:0] wDn;
   wire[ADRW-1:0] next_sAn_r;
   wire[ADRW-1:0] next_sAn_w;
   wire[DATW-1:0] next_rDn;
   wire[DATW-1:0] next_wDn;
   wire next_do_write, next_do_read;

   // States for one-hot state machine.
   reg st_idle=1, st_write=0, st_read1=0, st_read2=0;
   wire next_st_idle, next_st_write, next_st_read1, next_st_read2;

   synchroniser sync_NE(aNE, clk, sNE);
   synchroniser sync_NOE(aNOE, clk, sNOE);
   synchroniser sync_NWE(aNWE, clk, sNWE);

   always @(posedge clk) begin
      st_idle <= next_st_idle;
      st_write <= next_st_write;
      st_read1 <= next_st_read1;
      st_read2 <= next_st_read2;

      do_write <= next_do_write;
      do_read <= next_do_read;

      sAn_r <= next_sAn_r;
      sAn_w <= next_sAn_w;
      wDn <= next_wDn;
      rDn <= next_rDn;
   end

   /* Latch the address on the falling edge of NOE (read) or NWE (write).
      We can use the external address unsynchronised, as it will be stable
      when NOE/NWE toggles.
    */
   assign next_sAn_r = st_idle & ~sNE & ~sNOE ? aAn : sAn_r;
   assign next_sAn_w = st_idle & ~sNE & ~sNWE ? aAn : sAn_w;

   /* Incoming write. */
   /* Latch the write data on the falling edge of NWE. NWE is synchronised,
      so the synchronisation delay is enough to ensure that the async external
      data signal is stable at this point.
    */
   assign next_wDn = st_idle & ~sNE & ~sNWE ? aDn : wDn;
   // Trigger a register write when NWE goes low.
   assign next_do_write = st_idle & ~sNE & ~sNWE;
   assign next_st_write = (st_idle | st_write) & (~sNE & ~sNWE);

   /* Incoming read. */
   assign next_do_read = st_idle & ~sNE & ~sNOE;
   /* Wait one cycle for register read data to become available. */
   assign next_st_read1 = st_idle & ~sNE & ~sNOE;
   /* Put read data on the bus while NOE is asserted. */
   assign next_st_read2 = (st_read1 | st_read2) & ~sNE & ~sNOE;

   assign next_st_idle = ((st_read1 | st_read2) & (sNOE | sNE)) |
			 (st_write & (sNWE | sNE)) |
			 (st_idle & (sNE | (sNOE & sNWE)));

   /* Latch register read data one cycle after asserting do_read. */
   assign next_rDn = st_read1 ? read_data : rDn;
   /* Output data during read after latching read data. */
   assign io_output = st_read2 & next_st_read2;
   assign io_data = rDn;

   assign r_adr = sAn_r;
   assign w_adr = sAn_w;
   assign w_data = wDn;
endmodule // clocked_bus_slave

module top (
  /* FSMC */
	input crystal_clk,
	input STM32_PIN,
	input aNE, aNOE, aNWE,
	input [AW-1:0] aA,
	inout [DW-1:0] aD,
	//output [7:0] LED,
	input uart_tx_in, output uart_tx_out,
  /* VGA */
  output [2:0] red, green, blue,
  output hsync, vsync
);

   wire clk;
   wire nrst, lock;
   wire [7:0] pulse_counter;
   wire[DW-1:0] aDn_output;
   wire[DW-1:0] aDn_input;
   wire io_d_output;
   wire do_write;
   wire[AW-1:0] r_adr;
   wire[AW-1:0] w_adr;
   wire[DW-1:0] w_data;
   wire do_read;
   wire[DW-1:0] register_data;
   wire chk_err;
   wire[7:0] err_count;

   /* Type 101001 is output with tristate/enable and simple input. */
   SB_IO #(.PIN_TYPE(6'b1010_01), .PULLUP(1'b0))
     io_Dn[DW-1:0](.PACKAGE_PIN(aD),
	   .OUTPUT_ENABLE(io_d_output),
	   .D_OUT_0(aDn_output),
	   .D_IN_0(aDn_input)
	   );

   assign nrst = 1'b1;
   pllclk my_pll(crystal_clk, clk, nrst, lock);

   clocked_bus_slave #(.ADRW(AW), .DATW(DW))
     my_bus_slave(aNE, aNOE, aNWE,
		  aA, aDn_input,
		  clk, r_adr, w_adr,
		  do_read, register_data,
		  do_write, w_data,
		  io_d_output, aDn_output);

   /* The clocked_bus_slave asserts do_read once per read transaction on the
      external bus (synchronous on clk). This can be used to have side effects
      on read (eg. clear "data ready" on read of data register). However, in
      this particular case we have no such side effects, so can just decode
      the read data continously (clocked_bus_slave latches the read value).
    */
   always @(*) begin
      case (r_adr)
        default: register_data <= 0;
      endcase // case (r_adr)
   end

   reg [15:0] chadr;
   reg [7:0] chdata;
   reg 	     chbuf_w;
   reg 	     chadr_inc;

   always @(posedge clk) begin
      if (do_write) begin
	 case (w_adr)
	   8'h00: begin
	      // Write charbuf address
	      chadr <= w_data;
	      end
	   8'h02: begin
	      // Write charbuf data
	      chdata <= w_data[7:0];
	      chbuf_w <= 1'b1;
	   end
	   8'h03: begin
	      // Write charbuf data with auto-increment of address
	      chdata <= w_data[7:0];
	      chbuf_w <= 1'b1;
	      chadr_inc <= 1'b1;
	   end
	 endcase
      end else begin
	 if (chbuf_w == 1'b1) begin
	    chbuf_w <= 1'b0;
	 end
	 if (chadr_inc == 1'b1) begin
	    chadr <= chadr + 1;
	    chadr_inc <= 1'b0;
	 end
      end
   end // always @ (posedge_clk)   

   /* For debugging, proxy an UART Tx signal to the FTDI chip. */
   assign uart_tx_out = uart_tx_in;

   /* vga stuff */
   wire vga_clk = clk;
   wire [11:0] x, y;
   wire fb_enable, fb_reset;
   wire i_hsync, i_vsync; 
   wire [11:0] pixel_count, line_count;

   vga_blank blank(vga_clk, pixel_count, line_count, i_hsync, i_vsync, fb_reset, fb_enable);
   vga_adr_trans #(.FB_X_MAX(1280), .FB_Y_MAX(1024)) trans(vga_clk, pixel_count, line_count, fb_reset, fb_enable, x, y);

   wire [7:0] w_col, w_row;
   wire [7:0] buf_out;
   assign w_col = w_adr;
   char_buf buffer(vga_clk, chbuf_w, y[10:4], x[10:3], chadr[13:0], chdata, buf_out);

   wire [7:0] pixels;
   font_rom rom(vga_clk, y[3:0], buf_out, pixels);

   reg pixel;
   reg [2:0] ascii_x;
   always @(posedge vga_clk) begin
     pixel <= pixels[ascii_x];
     ascii_x <= ~(x[2:0]-1);
   end

   // Buffer output lines.
   always @(posedge vga_clk) begin
      red <= ~fb_enable ? 0 : (pixel ? 'b11 : 0);
      green <= ~fb_enable ? 0 : (pixel ? 'b11 : 0);
      blue <= 0;
      hsync <= i_hsync;
      vsync <= i_vsync;
   end

endmodule
