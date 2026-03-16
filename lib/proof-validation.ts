import sharp from 'sharp'
import { supabaseAdmin, type Proof } from './supabase'

// Generate a simple perceptual hash using average hash algorithm
export async function generatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  // Resize to 8x8 grayscale
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Calculate average pixel value
  const pixels = Array.from(data)
  const avg = pixels.reduce((sum, p) => sum + p, 0) / pixels.length

  // Generate hash: each bit is 1 if pixel > average, 0 otherwise
  let hash = ''
  for (const pixel of pixels) {
    hash += pixel > avg ? '1' : '0'
  }

  return hash
}

// Compare two perceptual hashes — returns similarity as percentage (0-100)
export function compareHashes(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0

  let matching = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matching++
  }

  return (matching / hash1.length) * 100
}

// Check if a new proof image is a duplicate of any existing proof
export async function checkForDuplicate(
  commitmentId: string,
  newHash: string
): Promise<{ isDuplicate: boolean; matchedProofId?: string }> {
  const { data: existingProofs } = await supabaseAdmin
    .from('proofs')
    .select('id, perceptual_hash')
    .eq('commitment_id', commitmentId)
    .not('perceptual_hash', 'is', null)

  if (!existingProofs) return { isDuplicate: false }

  for (const proof of existingProofs) {
    if (proof.perceptual_hash) {
      const similarity = compareHashes(newHash, proof.perceptual_hash)
      if (similarity > 90) {
        return { isDuplicate: true, matchedProofId: proof.id }
      }
    }
  }

  return { isDuplicate: false }
}

// Upload image to Supabase Storage and return public URL
export async function uploadProofImage(
  commitmentId: string,
  proofId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg'
  const path = `proofs/${commitmentId}/${proofId}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from('proof-images')
    .upload(path, imageBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) throw error

  const { data } = supabaseAdmin.storage
    .from('proof-images')
    .getPublicUrl(path)

  return data.publicUrl
}
