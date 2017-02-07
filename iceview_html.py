#! /usr/bin/python

import sys, os.path, re, getopt, subprocess


def usage():
    sys.stderr.write("""\
    Usage: iceview_html.py [-s BROWSER] INPUT.asc OUTPUT.html

Create a stand-alone .html file to display the floorplan / layout of an ICE40
design. Options:

    -s BROWSER
        Spawn BROWSER to display the generated OUTPUT.html file immediately.
""")
    sys.exit(0)

try:
    opts, args = getopt.getopt(sys.argv[1:], "s:")
except:
    usage()

spawn_browser = None
for opt, arg in opts:
    if opt == "-s":
        spawn_browser = arg
    else:
        usage()

if len(args) != 2:
    usage()

basedir = os.path.dirname(os.path.abspath(__file__))

asc_filename = args[0]
html_out_filename = args[1]
html_in_filename = basedir + "/" + "ice40_viewer.html"

# Copy the ice40_viewer.html file with appropriate replacements.
discard = False
with open(html_in_filename, "r") as f:
    with open(html_out_filename, "w") as g:
        for line in f:
            line = line.replace("var standalone_mode = false",
                                "var standalone_mode = true")
            # Inline referenced javascript files.
            m = re.match(r'^ *<script type="text/javascript" src="([^"]+)"></script> *$', line)
            if m:
                if m.group(1) == "chipdbs.txt.js":
                    # The chipdb is huge, so don't inline it. And the format is
                    # not likely to change often.
                    line = ('  <script type="text/javascript" src="file://' +
                            basedir + '/chipdbs.txt.js"></script>\n')
                else:
                    # Other javascript files are not too big. So inline them
                    # so that we do not later pick up a new version that is
                    # incompatible with our old code in .html.
                    js = open(basedir + "/" + m.group(1)).read()
                    line = "<script>\n" + js + "\n</script>\n";
            elif line == "    <!-- Start skip in standalone mode -->\n":
                discard = True
            if not discard:
                g.write(line)
            if line == "    <!-- End skip in standalone mode -->\n":
                discard = False
            if line == "// Standalone file data goes here.\n":
                # Print out the embedded .asc contents.
                g.write("g_fileData = \"\\\n")
                with open(asc_filename, "r") as h:
                    for a in h:
                        g.write(a.replace("\n", "\\n\\\n"))
                g.write("\";\n")

if spawn_browser:
    url = "file://" + os.path.abspath(html_out_filename)
    subprocess.call([spawn_browser, url])
