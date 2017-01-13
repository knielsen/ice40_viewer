/* vga_blank #( 
  .HFRONT(40),
  .HSYNCP(128),
  .HBACK(88),
  .HLINE(1056),
  .VFRONT(1),
  .VSYNCP(4),
  .VBACK(23),
  .VFRAME(628) // 800x600
/* vga_blank #(
  .HFRONT(119),
  .HSYNCP(88),
  .HBACK(118),
  .HLINE(2245),
  .VFRONT(1),
  .VSYNCP(2),
  .VBACK(29),
  .VFRAME(1112) */ // 1920x1080
module vga_blank(input clk, output reg [11:0] pixel_count, line_count, output reg hsync, output wire vsync, output reg fb_reset, output wire fb_enable);

parameter HFRONT = 48;
parameter HSYNCP = 112;
parameter HBACK = 248;
parameter HLINE = 1688;

parameter VFRONT = 1;
parameter VSYNCP = 3;
parameter VBACK = 38;
parameter VFRAME = 1066;

assign vsync = (line_count >= VFRONT & line_count < (VFRONT + VSYNCP));
assign fb_enable = pixel_count >= (HFRONT + HSYNCP + HBACK) & line_count >= (VFRONT + VSYNCP + VBACK);

always @(posedge clk) begin
  pixel_count <= next_pixel_count;
  line_count <= next_line_count;
  fb_reset <= next_fb_reset;
  hsync <= (pixel_count >= HFRONT & pixel_count < (HFRONT + HSYNCP)); 
end 

reg [11:0] next_pixel_count, next_line_count;
reg next_fb_reset;
reg next_hsync;

always @(*) begin
  next_pixel_count = (pixel_count == (HLINE - 1)) ? 0 : pixel_count + 1;
  next_line_count = (pixel_count == (HLINE - 1)) ? ((line_count == (VFRAME - 1)) ? 0 : line_count + 1) : line_count;
  next_fb_reset = (pixel_count == 0) & (line_count == 0);
end

endmodule

module vga_adr_trans(input clk, input [11:0] pixel_count, line_count, input fb_reset, fb_enable, output reg [11:0] x, y);
  parameter FB_X_MAX = 1280;
  parameter FB_Y_MAX = 1024;

  always @(posedge clk) begin
    if (fb_reset) begin
      x <= 0;
      y <= 0;
    end else begin
      if (fb_enable) begin
        x <= next_x;
        y <= next_y;
      end
    end
  end 

  reg [11:0] next_x, next_y;
  
  always @(*) begin 
    next_x = (x == FB_X_MAX-1) ? 0 : x + 1;
    next_y = (x == FB_X_MAX-1) ? ((y == FB_Y_MAX-1) ? 0 : y + 1) : y; 
  end 
endmodule

module vga_pos(input vga_clk, output enable, output [11:0] x, y);
  wire fb_reset;
  wire fb_enable;
  wire hsync, vsync; 
  wire [11:0] pixel_count, line_count;

  assign enable = fb_enable;

  vga_blank blank(vga_clk, pixel_count, line_count, hsync, vsync, fb_reset, fb_enable);
  vga_adr_trans #(.FB_X_MAX(1280), .FB_Y_MAX(1024)) trans(vga_clk, pixel_count, line_count, fb_reset, fb_enable, x, y);
endmodule
