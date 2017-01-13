module char_buf(input clk, w, input [7:0] r_row, r_col, input [13:0] w_addr, input [7:0] a_in, output reg [7:0] a_out);
  reg [7:0] buffer[0:(160*64-1)];
  wire [6:0] sum1;
  wire [6:0] sum2;
  wire [13:0] idx;

  //initial $readmemh("string.list", buffer); 

  // Hardcoded for 160 width, idx = row<<7+row<<5+col
  assign sum1 = {1'b0, r_row[5:0]} + {4'b0000, r_col[7:5]};
  assign sum2 = {2'b00, sum1[6:2]} + {1'b0, r_row[5:0]};
  assign idx = {sum2[6:0], sum1[1:0], r_col[4:0]};

  always @(posedge clk) begin 
    a_out <= buffer[idx];
  end

  always @(posedge clk) begin
    if (w) begin
      buffer[w_addr] <= a_in;
    end
  end 
endmodule
