import { kebabCase, pascalCase, snakeCase } from './svg-utils';

export type FrameworkId =
  | 'react'
  | 'react-native'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'flutter'
  | 'swiftui'
  | 'kotlin'
  | 'html'
  | 'nextjs';

export type Framework = {
  id: FrameworkId;
  label: string;
  language: string;
  filename(name: string): string;
  generate(args: { name: string; svg: string; size: number }): string;
};

function inlineSvgWithSize(svg: string, size: number): string {
  let out = svg.replace(/(<svg[^>]*\s)width=["'][^"']*["']/i, '$1');
  out = out.replace(/(<svg[^>]*\s)height=["'][^"']*["']/i, '$1');
  out = out.replace(/<svg/i, `<svg width="${size}" height="${size}"`);
  if (!/<svg[^>]*\sviewBox=/i.test(out)) {
    out = out.replace(/<svg/i, `<svg viewBox="0 0 120 120"`);
  }
  return out;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');
}

function escapeBackticks(text: string): string {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function svgInner(svg: string): string {
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1].trim() : svg;
}

function svgRootAttrs(svg: string): Record<string, string> {
  const m = svg.match(/<svg([^>]*)>/i);
  if (!m) return {};
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(m[1])) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function getViewBox(svg: string): string {
  return svgRootAttrs(svg).viewBox || '0 0 120 120';
}

const REACT: Framework = {
  id: 'react',
  label: 'React',
  language: 'tsx',
  filename: (name) => `${pascalCase(name)}Icon.tsx`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    const inner = svgInner(svg);
    const viewBox = getViewBox(svg);
    return `// ${compName}.tsx
type Props = {
  size?: number;
  className?: string;
};

const SVG_INNER = \`${escapeBackticks(inner)}\`;

export default function ${compName}({ size = ${size}, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="${viewBox}"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: SVG_INNER }}
    />
  );
}

// Usage:
// <${compName} size={48} />
`;
  },
};

const NEXTJS: Framework = {
  id: 'nextjs',
  label: 'Next.js',
  language: 'tsx',
  filename: (name) => `${pascalCase(name)}Icon.tsx`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    const inner = svgInner(svg);
    const viewBox = getViewBox(svg);
    return `// app/components/${compName}.tsx
'use client';

type Props = {
  size?: number;
  className?: string;
};

const SVG_INNER = \`${escapeBackticks(inner)}\`;

export default function ${compName}({ size = ${size}, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="${viewBox}"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: SVG_INNER }}
    />
  );
}

// Usage in any client/server component:
// <${compName} size={48} />
`;
  },
};

const REACT_NATIVE: Framework = {
  id: 'react-native',
  label: 'React Native',
  language: 'tsx',
  filename: (name) => `${pascalCase(name)}Icon.tsx`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    return `// ${compName}.tsx — requires: npm install react-native-svg
import * as React from 'react';
import { SvgXml } from 'react-native-svg';

type Props = { size?: number };

const SVG = \`${escapeBackticks(svg)}\`;

export default function ${compName}({ size = ${size} }: Props) {
  return <SvgXml xml={SVG} width={size} height={size} />;
}

// Usage:
// <${compName} size={48} />
`;
  },
};

const VUE: Framework = {
  id: 'vue',
  label: 'Vue 3',
  language: 'vue',
  filename: (name) => `${pascalCase(name)}Icon.vue`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    const inner = svgInner(svg);
    const viewBox = getViewBox(svg);
    return `<!-- ${compName}.vue -->
<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: ${size} });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="${viewBox}"
    xmlns="http://www.w3.org/2000/svg"
    v-html="inner"
  />
</template>

<script lang="ts">
const inner = \`${escapeBackticks(inner)}\`;
export { inner };
</script>

<!-- Usage:
<${compName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')} :size="48" />
-->
`;
  },
};

const SVELTE: Framework = {
  id: 'svelte',
  label: 'Svelte',
  language: 'svelte',
  filename: (name) => `${pascalCase(name)}Icon.svelte`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    const inner = svgInner(svg);
    const viewBox = getViewBox(svg);
    return `<!-- ${compName}.svelte -->
<script lang="ts">
  export let size: number = ${size};
  const inner = \`${escapeBackticks(inner)}\`;
</script>

<svg
  width={size}
  height={size}
  viewBox="${viewBox}"
  xmlns="http://www.w3.org/2000/svg"
>
  {@html inner}
</svg>

<!-- Usage: <${compName} size={48} /> -->
`;
  },
};

const ANGULAR: Framework = {
  id: 'angular',
  label: 'Angular',
  language: 'ts',
  filename: (name) => `${kebabCase(name)}-icon.component.ts`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'IconComponent';
    const selector = kebabCase(name) + '-icon';
    const inner = svgInner(svg);
    const viewBox = getViewBox(svg);
    return `// ${selector}.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="${viewBox}"
      xmlns="http://www.w3.org/2000/svg"
      [innerHTML]="safeInner"
    ></svg>
  \`,
})
export class ${compName} implements OnInit {
  @Input() size = ${size};
  safeInner!: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.safeInner = this.sanitizer.bypassSecurityTrustHtml(\`${escapeBackticks(inner)}\`);
  }
}

// Usage: <${selector} [size]="48"></${selector}>
`;
  },
};

const FLUTTER: Framework = {
  id: 'flutter',
  label: 'Flutter',
  language: 'dart',
  filename: (name) => `${snakeCase(name)}_icon.dart`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    return `// ${snakeCase(name)}_icon.dart — requires: flutter_svg: ^2.0.0
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ${compName} extends StatelessWidget {
  final double size;
  const ${compName}({super.key, this.size = ${size}});

  static const String _svg = '''${svg}''';

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _svg,
      width: size,
      height: size,
    );
  }
}

// Usage: ${compName}(size: 48)
`;
  },
};

const SWIFTUI: Framework = {
  id: 'swiftui',
  label: 'SwiftUI',
  language: 'swift',
  filename: (name) => `${pascalCase(name)}Icon.swift`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    return `// ${compName}.swift — requires SVGKit (https://github.com/SVGKit/SVGKit)
import SwiftUI
import SVGKit

public struct ${compName}: View {
    public var size: CGFloat

    public init(size: CGFloat = ${size}) {
        self.size = size
    }

    private static let svgString: String = """
${svg}
"""

    public var body: some View {
        if let data = Self.svgString.data(using: .utf8),
           let img = SVGKImage(data: data) {
            img.size = CGSize(width: size, height: size)
            return AnyView(Image(uiImage: img.uiImage).resizable().frame(width: size, height: size))
        }
        return AnyView(EmptyView())
    }
}

// Usage: ${compName}(size: 48)
`;
  },
};

const KOTLIN: Framework = {
  id: 'kotlin',
  label: 'Kotlin (Compose)',
  language: 'kt',
  filename: (name) => `${pascalCase(name)}Icon.kt`,
  generate: ({ name, svg, size }) => {
    const compName = pascalCase(name) + 'Icon';
    return `// ${compName}.kt — requires: io.coil-kt:coil-svg + io.coil-kt:coil-compose
package com.iconforge

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest

private const val SVG = """${svg}"""

@Composable
fun ${compName}(sizeDp: Int = ${size}) {
    val context = LocalContext.current
    val request = ImageRequest.Builder(context)
        .data(SVG.toByteArray())
        .decoderFactory(SvgDecoder.Factory())
        .build()
    AsyncImage(
        model = request,
        contentDescription = "${name}",
        modifier = Modifier.size(sizeDp.dp),
    )
}

// Usage: ${compName}(sizeDp = 48)
`;
  },
};

const HTML: Framework = {
  id: 'html',
  label: 'HTML / CSS',
  language: 'html',
  filename: (name) => `${kebabCase(name)}.html`,
  generate: ({ name, svg, size }) => {
    return `<!-- ${kebabCase(name)}.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${name}</title>
  <style>
    .icon-${kebabCase(name)} {
      width: ${size}px;
      height: ${size}px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <!-- Inline SVG -->
  <span class="icon-${kebabCase(name)}">
${indent(inlineSvgWithSize(svg, size), 4)}
  </span>

  <!-- As <img> -->
  <!--
  <img src="data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}"
       width="${size}" height="${size}" alt="${name}" />
  -->
</body>
</html>
`;
  },
};

export const FRAMEWORKS: Framework[] = [
  REACT,
  NEXTJS,
  VUE,
  SVELTE,
  ANGULAR,
  REACT_NATIVE,
  FLUTTER,
  SWIFTUI,
  KOTLIN,
  HTML,
];

export const FRAMEWORK_BY_ID: Record<FrameworkId, Framework> = Object.fromEntries(
  FRAMEWORKS.map((f) => [f.id, f]),
) as Record<FrameworkId, Framework>;
