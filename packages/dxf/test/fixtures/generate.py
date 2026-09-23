# Regenerates the DXF fixtures of the tests with ezdxf (https://ezdxf.mozman.at):
#
#   python3 -m venv .venv && .venv/bin/pip install ezdxf
#   .venv/bin/python test/fixtures/generate.py
#
# The geometry is chosen so that the expected extents can be worked out by hand
# (see parse-dxf.test.ts).

from pathlib import Path

import ezdxf
from ezdxf import units

HERE = Path(__file__).parent


def r12_without_blocks():
    doc = ezdxf.new("R12")
    doc.layers.add("WALLS", color=1)
    doc.layers.add("NOTES", color=3).off()
    msp = doc.modelspace()

    msp.add_line((0, 0), (100, 50), dxfattribs={"layer": "WALLS"})
    msp.add_polyline2d([(10, 10), (20, 10), (20, 20)], close=True, dxfattribs={"layer": "WALLS"})
    msp.add_circle((50, 50), 10, dxfattribs={"layer": "WALLS"})
    msp.add_arc((0, 0), 20, 0, 90, dxfattribs={"layer": "WALLS"})
    msp.add_text("Hello", dxfattribs={"layer": "NOTES", "height": 2.5}).set_placement((5, -5))
    msp.add_point((-10, 0))

    doc.saveas(HERE / "r12-without-blocks.dxf")


def r2000_with_blocks():
    doc = ezdxf.new("R2000")
    doc.units = units.MM
    doc.layers.add("DOORS", color=5)
    doc.layers.add("FURNITURE", color=2).freeze()
    msp = doc.modelspace()

    door = doc.blocks.new("DOOR")
    door.add_line((0, 0), (10, 0), dxfattribs={"layer": "DOORS"})
    door.add_arc((0, 0), 10, 0, 90, dxfattribs={"layer": "DOORS"})

    table = doc.blocks.new("TABLE", base_point=(5, 5))
    table.add_lwpolyline([(0, 0), (10, 0), (10, 10), (0, 10)], close=True, dxfattribs={"layer": "FURNITURE"})

    msp.add_blockref("DOOR", (100, 0), dxfattribs={"rotation": 90, "layer": "DOORS"})
    msp.add_blockref("DOOR", (0, 0), dxfattribs={"xscale": 2, "yscale": 2, "layer": "DOORS"})
    msp.add_blockref("TABLE", (50, 50), dxfattribs={"layer": "FURNITURE"})
    # Bulge 1 from (0, -10) to (20, -10): a half circle that dips down to y = -20.
    msp.add_lwpolyline([(0, -10, 0, 0, 1), (20, -10, 0, 0, 0)], format="xyseb")
    msp.add_mtext("Ground floor", dxfattribs={"insert": (30, 70), "char_height": 3})
    msp.add_ellipse((0, 0), major_axis=(5, 0), ratio=0.5)
    hatch = msp.add_hatch(color=1)
    hatch.paths.add_polyline_path([(60, 0), (70, 0), (70, 10)], is_closed=True)

    doc.saveas(HERE / "r2000-with-blocks.dxf")


def r2018_nested_blocks():
    doc = ezdxf.new("R2018")
    doc.units = units.M
    doc.layers.add("DESKS", color=4)
    doc.layers.add("CHAIRS", color=6)
    doc.layers.add("AXES", color=8)
    msp = doc.modelspace()

    chair = doc.blocks.new("CHAIR")
    chair.add_circle((0, 0), 0.5, dxfattribs={"layer": "CHAIRS"})

    desk = doc.blocks.new("DESK")
    desk.add_lwpolyline([(0, 0), (2, 0), (2, 1), (0, 1)], close=True, dxfattribs={"layer": "DESKS"})
    desk.add_blockref("CHAIR", (1, -0.5), dxfattribs={"layer": "CHAIRS"})

    msp.add_blockref("DESK", (0, 0), dxfattribs={"layer": "DESKS"})
    msp.add_blockref("DESK", (5, 0), dxfattribs={"rotation": 180, "layer": "DESKS"})
    msp.add_line((0, -0.5), (4, -0.5), dxfattribs={"layer": "AXES"})
    msp.add_spline([(0, 0), (1, 1), (2, 0), (3, 1)], dxfattribs={"layer": "AXES"})

    # Paper space: must stay out of the Dessin parsé.
    doc.layout("Layout1").add_line((0, 0), (1000, 1000))

    doc.saveas(HERE / "r2018-nested-blocks.dxf")


def corrupt():
    text = (HERE / "r2000-with-blocks.dxf").read_text()
    (HERE / "corrupt.dxf").write_text(text[: len(text) // 2])


r12_without_blocks()
r2000_with_blocks()
r2018_nested_blocks()
corrupt()
