module font_rom(input clk, input [3:0] y, input [7:0] ascii, output reg [7:0] pixel); 
  reg [0:7] data [0:4095]; 
  initial $readmemh("font.list", data); 

  always @(posedge clk) begin
    pixel <= data[{ascii, ~y}];
  end
endmodule
