'use client'

import { PIECES } from '@genui-github/ui/pieces'
import type { Comparison, Metric, StatusList } from '@genui-github/ui/schemas'

type Bound =
  | { name: 'Metric'; props: Metric.MetricProps }
  | { name: 'Comparison'; props: Comparison.ComparisonProps }
  | { name: 'StatusList'; props: StatusList.StatusListProps }

/** A catalog component drawn directly with props the system bound from a results file, as the renderer fixtures are. */
export function Piece({ name, props }: Bound) {
  const { Component } = PIECES[name]!
  return <Component props={props} state="default" />
}
