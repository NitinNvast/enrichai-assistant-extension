import { describe, expect, it } from 'vitest'
import { parseUrlContext } from './urlContext'

const URL_WITH_CONTEXT =
  'https://cc.gbiqa.groupbycloud.com/enrich/enrichai/hlqa' +
  '?projectId=Project_k45TA1q7jMNrTJ5CQDGEj4oz' +
  '&catalogId=Catalog_9jxk5fTvrYZbG21efKPLkgcx' +
  '&terminalNodeId=ProductTreeNode_QCYeBKDS2mJmFxBXw0Ac25Dr' +
  '&attributeName=' + encodeURIComponent('[T]Fit - Shoe Width')

describe('parseUrlContext', () => {
  it('extracts all context params', () => {
    const ctx = parseUrlContext(URL_WITH_CONTEXT)
    expect(ctx.projectId).toBe('Project_k45TA1q7jMNrTJ5CQDGEj4oz')
    expect(ctx.catalogId).toBe('Catalog_9jxk5fTvrYZbG21efKPLkgcx')
    expect(ctx.terminalNodeId).toBe('ProductTreeNode_QCYeBKDS2mJmFxBXw0Ac25Dr')
  })
  it('strips the [T] prefix from attributeName', () => {
    expect(parseUrlContext(URL_WITH_CONTEXT).attributeName).toBe('Fit - Shoe Width')
  })
  it('returns nulls when params are absent', () => {
    const ctx = parseUrlContext('https://cc.gbiqa.groupbycloud.com/enrich/enrichai/hlqa')
    expect(ctx).toEqual({ projectId: null, catalogId: null, terminalNodeId: null, attributeName: null })
  })
})
