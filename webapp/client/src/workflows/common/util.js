export const isValidOsdGldsAccession = (accession) => {
  if (!accession || accession.trim() === '') {
    return false
  }
  if (!/^(OSD|GLDS)-[0-9]{1,6}$/i.test(accession.trim())) {
    return false
  }
  return true
}

export const isValidPrimer = (primer) => {
  if (!primer || primer.trim() === '') {
    return true
  }
  if (!/^[atgcuryswkmbdhvn\.-]{1,200}$/i.test(primer.trim())) {
    return false
  }
  return true
}
