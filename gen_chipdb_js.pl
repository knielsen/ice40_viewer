#! /usr/bin/perl

use strict;
use warnings;

open G, '>', 'chipdbs.js';
for my $x ([qw(chipdb1k_text chipdb-1k.txt)], [qw(chipdb8k_text chipdb-8k.txt)]) {
  my ($varname, $src_chipdb_file) = @$x;
  open F, '<', $src_chipdb_file
      or die "Failed to open file '$src_chipdb_file': $!\n";
  my $chipdb_src;
  { local $/ = undef; $chipdb_src = <F>; }
  close F;
  print G "var $varname = \"\\\n";

  my $linesize = 1000;
  for (my $i = 0; $i < length($chipdb_src); $i += $linesize) {
    my $line = substr($chipdb_src, $i, $linesize);
    $line =~ s/\n/\\n/gs;
    print G $line, "\\\n";
  }

  print G "\";\n";
}

close G;
