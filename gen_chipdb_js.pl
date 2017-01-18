#! /usr/bin/perl

use strict;
use warnings;

my $src_chipdb_file = $ARGV[0];
die "Usage: $0 <chipdb-8k.txt location>\n"
    unless defined $src_chipdb_file;
open F, '<', $src_chipdb_file
    or die "Failed to open file '$src_chipdb_file': $!\n";
my $chipdb_src;
{ local $/ = undef; $chipdb_src = <F>; }
close F;

open G, '>', 'chipdb-8k.txt.js';
print G "var chipdb_text = \"\\\n";

my $linesize = 1000;
for (my $i = 0; $i < length($chipdb_src); $i += $linesize) {
  my $line = substr($chipdb_src, $i, $linesize);
  $line =~ s/\n/\\n/gs;
  print G $line, "\\\n";
}

print G "\";\n";
close G;
