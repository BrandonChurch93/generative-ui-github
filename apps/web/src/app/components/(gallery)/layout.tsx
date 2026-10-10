import type { ReactNode } from 'react'
import { Gallery } from '../_gallery/Gallery'

// The gallery lives in a layout so that focusing a card, which rewrites the address to /components/<name>,
// keeps the composed set mounted instead of remounting a new page.
export default function GalleryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Gallery />
    </>
  )
}
