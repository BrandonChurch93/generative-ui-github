import { redirect } from 'next/navigation'
import { CATALOG } from '@genui-github/ui/catalog'

export default function CatalogIndex() {
  redirect(`/catalog/${CATALOG[0]!.name}`)
}
