#!/usr/bin/env python3
"""Genera web/styles/a0-ornamentos.css: los ornamentos SVG del sistema visual como variables CSS (data URI).
Se usan como máscaras (mask-image), así toman el color o el degradado dorado del elemento.
Uso: python3 tools/ornamentos.py"""
from urllib.parse import quote
import os

def uri(svg):
    svg = ' '.join(svg.split())
    return 'url("data:image/svg+xml,' + quote(svg, safe=" ='/:,.-()") + '")'

def svg(vb, body, extra=''):
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}' fill='none' stroke='black' {extra}>{body}</svg>"

# Esquina art déco (arriba a la izquierda); las otras tres son espejos
CORNER = ("<path d='M1.5 38.5V10Q1.5 1.5 10 1.5H38.5' stroke-width='1.8'/>"
          "<path d='M6 31V12.5L12.5 6H31' stroke-width='1.1'/>"
          "<path d='M10.5 38.5V19M19 10.5H38.5' stroke-width='.8'/>"
          "<path d='M15 9.5l5.5 5.5-5.5 5.5L9.5 15z' fill='black' stroke='none'/>"
          "<path d='M25 3.6h3.2v3.2H25zM3.6 25h3.2v3.2H3.6z' fill='black' stroke='none'/>")
def corner(m):
    return svg('0 0 40 40', f"<g transform='{m}'>{CORNER}</g>")
corners = {
    'tl': corner('matrix(1 0 0 1 0 0)'),
    'tr': corner('matrix(-1 0 0 1 40 0)'),
    'bl': corner('matrix(1 0 0 -1 0 40)'),
    'br': corner('matrix(-1 0 0 -1 40 40)'),
}
# Esquina grande y más rica para la portada y los marcos de las hojas
BIG = ("<path d='M2 78V22Q2 2 22 2H78' stroke-width='2.4'/>"
       "<path d='M10 64V24L24 10H64' stroke-width='1.4'/>"
       "<path d='M17 78V30L30 17H78' stroke-width='.9'/>"
       "<circle cx='24' cy='24' r='5' fill='black' stroke='none'/>"
       "<circle cx='24' cy='24' r='9' stroke-width='1'/>"
       "<path d='M36 4l4 4-4 4-4-4zM4 36l4 4-4 4-4-4z' fill='black' stroke='none'/>"
       "<path d='M44 8h22M8 44v22' stroke-width='3' stroke-dasharray='2 3'/>")
def big(m):
    return svg('0 0 80 80', f"<g transform='{m}'>{BIG}</g>")
bigs = {
    'tl': big('matrix(1 0 0 1 0 0)'), 'tr': big('matrix(-1 0 0 1 80 0)'),
    'bl': big('matrix(1 0 0 -1 0 80)'), 'br': big('matrix(-1 0 0 -1 80 80)'),
}
# Divisor con rombo y volutas
RULE = svg('0 0 240 20', "<path d='M0 10H92M148 10H240' stroke-width='1.2'/>"
           "<path d='M92 10c6-8 13-8 18 0M148 10c-6-8-13-8-18 0' stroke-width='1.2'/>"
           "<path d='M120 2l8 8-8 8-8-8zM120 6l-4 4 4 4 4-4z' fill='black' fill-rule='evenodd' stroke='none'/>"
           "<circle cx='104' cy='10' r='2' fill='black' stroke='none'/><circle cx='136' cy='10' r='2' fill='black' stroke='none'/>"
           "<path d='M20 6v8M220 6v8M30 8v4M210 8v4' stroke-width='1'/>", "preserveAspectRatio='none'")
# Florón para títulos (a los lados del texto)
FLEUR_L = svg('0 0 60 16', "<path d='M0 8H40' stroke-width='1'/><path d='M40 8c4-6 10-6 12 0-2 6-8 6-12 0z' fill='black' stroke='none'/><circle cx='56' cy='8' r='2' fill='black' stroke='none'/>")
FLEUR_R = svg('0 0 60 16', "<path d='M60 8H20' stroke-width='1'/><path d='M20 8c-4-6-10-6-12 0 2 6 8 6 12 0z' fill='black' stroke='none'/><circle cx='4' cy='8' r='2' fill='black' stroke='none'/>")
# Escudo heráldico (para características) y su filo interior
CREST = svg('0 0 100 112', "<path d='M50 2 L92 14 L96 20 L96 58 C96 84 74 100 50 110 C26 100 4 84 4 58 L4 20 L8 14 Z' fill='black' stroke='none'/>")
# Remache
RIVET = svg('0 0 10 10', "<circle cx='5' cy='5' r='4.2' fill='black' stroke='none'/>")
# Filigrana de arco (encabezado de tarjeta grande)
ARCH = svg('0 0 200 24', "<path d='M4 22C40 22 60 4 100 4s60 18 96 18' stroke-width='1.4'/><path d='M24 22C54 20 72 9 100 9s46 11 76 13' stroke-width='.8'/><path d='M100 0l4 4-4 4-4-4z' fill='black' stroke='none'/>", "preserveAspectRatio='none'")
# Puntas de cinta (etiquetas)
NOTCH_L = svg('0 0 12 24', "<path d='M12 0H0L7 12L0 24H12Z' fill='black' stroke='none'/>", "preserveAspectRatio='none'")
NOTCH_R = svg('0 0 12 24', "<path d='M0 0H12L5 12L12 24H0Z' fill='black' stroke='none'/>", "preserveAspectRatio='none'")
# Grietas (vida baja, la usa el módulo de identidad) y vetas de metal
CRACK = svg('0 0 120 120', "<path d='M0 34L18 40L26 30L44 46L52 38L70 52M26 30L22 12M44 46L40 68L56 80M70 52L88 50L104 64L120 60M88 50L94 30' stroke-width='1.2'/>")

out = ['/* Generado por tools/ornamentos.py: no se edita a mano. */', ':root{']
for k, v in corners.items(): out.append(f'  --orn-c-{k}:{uri(v)};')
for k, v in bigs.items(): out.append(f'  --orn-big-{k}:{uri(v)};')
for name, v in [('rule', RULE), ('fleur-l', FLEUR_L), ('fleur-r', FLEUR_R), ('crest', CREST), ('rivet', RIVET), ('arch', ARCH), ('notch-l', NOTCH_L), ('notch-r', NOTCH_R), ('crack', CRACK)]:
    out.append(f'  --orn-{name}:{uri(v)};')
out.append('}')
here = os.path.dirname(os.path.abspath(__file__))
open(os.path.join(here, '..', 'web', 'styles', 'a0-ornamentos.css'), 'w').write('\n'.join(out) + '\n')
print('ok')
