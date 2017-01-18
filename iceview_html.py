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
def js_absurl(m):
    return '<script type="text/javascript" src="file://' + basedir + '/' + m.group(1) + '">'
discard = False
with open(html_in_filename, "r") as f:
    with open(html_out_filename, "w") as h:
        for line in f:
            line2 = line.replace("var standalone_mode = false",
                                 "var standalone_mode = true")
            line3 = re.sub(r'<script type="text/javascript" src="([^"]+)">', js_absurl, line2)
            if line3 == "    <!-- Start skip in standalone mode -->\n":
                discard = True
            if not discard:
                h.write(line3)
            if line3 == "    <!-- End skip in standalone mode -->\n":
                discard = False
            if line3 == "  <!-- Standalone chipdb included here -->\n":
                # print out the statement to load the chipdb.
                h.write('  <script type="text/javascript" src="file://' + basedir +
                        '/chipdb-8k.txt.js"></script>\n')
            if line3 == "// Standalone file data goes here.\n":
                # Print out the embedded .asc contents.
                h.write("g_fileData = \"\\\n")
                with open(asc_filename, "r") as g:
                    for a in g:
                        h.write(a.replace("\n", "\\n\\\n"))
                h.write("\";\n")

if spawn_browser:
    url = "file://" + os.path.abspath(html_out_filename)
    subprocess.call([spawn_browser, url])
