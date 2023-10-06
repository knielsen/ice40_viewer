/*

RGB LED blinker

*/

`default_nettype none

module top (
  input             clki,               // 48MHz oscillator input on Fomu-PVT
  output            rgb0,               // RGB LED pin 0 (**DO NOT** drive directly)
  output            rgb1,               // RGB LED pin 1 (**DO NOT** drive directly)
  output            rgb2,               // RGB LED pin 2 (**DO NOT** drive directly)
  output            usb_dp,             // USB D+
  output            usb_dn,             // USB D-
  output            usb_dp_pu           // USB D+ pull-up
);

  // disable Fomu USB
  assign usb_dp = 1'b0;
  assign usb_dn = 1'b0;
  assign usb_dp_pu = 1'b0;

  // connect system clock (with buffering)
  wire clk;
  SB_GB clk_gb (
    .USER_SIGNAL_TO_GLOBAL_BUFFER(clki),
    .GLOBAL_BUFFER_OUTPUT(clk)
  );

  // connect RGB LED driver (see: FPGA-TN-1288-ICE40LEDDriverUsageGuide.pdf)
  wire led_r;
  wire led_g;
  wire led_b;
  SB_RGBA_DRV #(
    .CURRENT_MODE("0b1"),               // half current
    .RGB0_CURRENT("0b001111"),          // 8 mA
    .RGB1_CURRENT("0b000011"),          // 4 mA
    .RGB2_CURRENT("0b000011")           // 4 mA
  ) RGBA_DRIVER (
    .CURREN(1'b1),
    .RGBLEDEN(1'b1),
    .RGB0PWM(led_g),                    // green
    .RGB1PWM(led_r),                    // red
    .RGB2PWM(led_b),                    // blue
    .RGB0(rgb0),
    .RGB1(rgb1),
    .RGB2(rgb2)
  );

  // establish free-running counter
  reg [28:0] counter;
  initial counter = 0;
  always @(posedge clk)
    counter <= counter + 1'b1;

  // drive LEDs from slower-changing counter bits
  assign led_r = counter[28];           // ~11.2s cycle,  ~5.6s on/off
  assign led_g = counter[27];           //  ~5.6s cycle,  ~2.8s on/off
  assign led_b = counter[26];           //  ~2.8s cycle,  ~1.4s on/off
//  assign led_x = counter[25];           //  ~1.4s cycle,  ~0.7s on/off
//  assign led_x = counter[24];           //  ~0.7s cycle,  ~0.35s on/off

endmodule
