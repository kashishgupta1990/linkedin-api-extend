import type {
  AffiliatedCompany,
  Artifact,
  ExperienceItem,
  Group,
  LIDate,
  LinkedVectorImage,
  Organization,
  RawOrganization,
  ShowcasePage,
  VectorImage
} from './types'
import { omit } from './utils'

/**
 * Return the ID of a given Linkedin URN.
 *
 * Example: urn:li:fs_miniProfile:<id>
 */
export function getIdFromUrn(urn?: string) {
  return urn?.split(':').at(-1)
}

/**
 * Return the URN of a raw group update
 *
 * Example: urn:li:fs_miniProfile:<id>
 * Example: urn:li:fs_updateV2:(<urn>,GROUP_FEED,EMPTY,DEFAULT,false)
 */
export function getUrnFromRawUpdate(update?: string) {
  return update?.split('(')[1]?.split(',').at(0)?.trim()
}

export function isLinkedInUrn(urn?: string) {
  return urn?.startsWith('urn:li:') && urn.split(':').length >= 4
}

export function parseExperienceItem(
  item: any,
  { isGroupItem = false, included }: { isGroupItem?: boolean; included: any[] }
): ExperienceItem {
  const component = item.components.entityComponent
  const title = component.titleV2.text.text
  const subtitle = component.subtitle
  const subtitleParts = subtitle?.text?.split(' · ')
  const company = subtitleParts?.[0]
  const employmentType = subtitleParts?.[1]
  const companyId: string | undefined =
    getIdFromUrn(component.image?.attributes?.[0]?.['*companyLogo']) ??
    component.image?.actionTarget?.split('/').findLast(Boolean)
  const companyUrn = companyId ? `urn:li:fsd_company:${companyId}` : undefined
  let companyImage: string | undefined

  if (companyId) {
    const companyEntity = included.find((i: any) =>
      i.entityUrn?.endsWith(companyId)
    )

    if (companyEntity) {
      companyImage = resolveImageUrl(
        companyEntity.logoResolutionResult?.vectorImage
      )
    }
  }

  const metadata = component?.metadata || {}
  const location = metadata?.text

  const durationText = component.caption?.text
  const durationParts = durationText?.split(' · ')
  const dateParts = durationParts?.[0]?.split(' - ')

  const duration = durationParts?.[1]
  const startDate = dateParts?.[0]
  const endDate = dateParts?.[1]

  const subComponents = component.subComponents
  const fixedListComponent =
    subComponents?.components?.[0]?.components?.fixedListComponent

  const fixedListTextComponent =
    fixedListComponent?.components?.[0]?.components?.textComponent

  const description = fixedListTextComponent?.text?.text

  const parsedData: ExperienceItem = {
    title,
    companyName: !isGroupItem ? company : undefined,
    employmentType: isGroupItem ? company : employmentType,
    location,
    duration,
    startDate,
    endDate,
    description,
    company: {
      entityUrn: companyUrn,
      id: companyId,
      name: !isGroupItem ? company : undefined,
      logo: companyImage
    }
  }

  return parsedData
}

export function getGroupedItemId(item: any): string | undefined {
  const subComponents = item.components?.entityComponent?.subComponents
  const subComponentsComponents = subComponents?.components?.[0]?.components

  const pagedListComponentId = subComponentsComponents?.['*pagedListComponent']

  if (pagedListComponentId?.includes('fsd_profilePositionGroup')) {
    const pattern = /urn:li:fsd_profilePositionGroup:\([\dA-z]+,[\dA-z]+\)/
    const match = pagedListComponentId.match(pattern)
    return match?.[0]
  }

  return undefined
}

export function resolveImageUrl(vectorImage?: VectorImage): string | undefined {
  if (!vectorImage?.rootUrl) return
  if (!vectorImage.artifacts?.length) return

  const largestArtifact = vectorImage.artifacts.reduce(
    (a, b) => {
      if (b.width > a.width) return b
      return a
    },
    vectorImage.artifacts[0] ?? ({ width: 0, height: 0 } as Artifact)
  )

  if (!largestArtifact?.fileIdentifyingUrlPathSegment) return

  return `${vectorImage.rootUrl}${largestArtifact.fileIdentifyingUrlPathSegment}`
}

export function resolveLinkedVectorImageUrl(
  linkedVectorImage?: LinkedVectorImage
): string | undefined {
  return resolveImageUrl(linkedVectorImage?.['com.linkedin.common.VectorImage'])
}

export function stringifyLinkedInDate(date?: LIDate): string | undefined {
  if (!date) return undefined
  if (date.year === undefined) return undefined

  return [date.year, date.month].filter(Boolean).join('-')
}

export function normalizeRawOrganization(
  o?: RawOrganization
): Organization | undefined {
  if (!o) return undefined

  const id = getIdFromUrn(o.entityUrn)
  if (!id) return undefined

  return {
    ...omit(
      o,
      'universalName',
      'logo',
      'backgroundCoverImage',
      'coverPhoto',
      'overviewPhoto',
      '$recipeType',
      'callToAction',
      'phone',
      'permissions',
      'followingInfo',
      'adsRule',
      'autoGenerated',
      'lcpTreatment',
      'staffingCompany',
      'showcase',
      'paidCompany',
      'claimable',
      'claimableByViewer',
      'viewerPendingAdministrator',
      'viewerConnectedToAdministrator',
      'viewerFollowingJobsUpdates',
      'viewerEmployee',
      'associatedHashtags',
      'associatedHashtagsResolutionResults',
      'affiliatedCompaniesResolutionResults',
      'groupsResolutionResults',
      'showcasePagesResolutionResults'
    ),
    id,
    publicIdentifier: o.universalName,
    logo: resolveLinkedVectorImageUrl(o.logo?.image),
    backgroundCoverImage: resolveLinkedVectorImageUrl(
      o.backgroundCoverImage?.image
    ),
    coverPhoto:
      o.coverPhoto?.['com.linkedin.voyager.common.MediaProcessorImage']?.id,
    overviewPhoto:
      o.overviewPhoto?.['com.linkedin.voyager.common.MediaProcessorImage']?.id,
    callToActionUrl: o.callToAction?.url,
    phone: o.phone?.number,
    numFollowers: o.followingInfo?.followerCount,
    affiliatedCompaniesResolutionResults: Object.fromEntries(
      Object.entries(o.affiliatedCompaniesResolutionResults ?? {}).map(
        ([k, v]) => [
          k,
          {
            ...omit(
              v,
              'universalName',
              'logo',
              '$recipeType',
              'followingInfo',
              'showcase',
              'paidCompany'
            ),
            id: getIdFromUrn(v.entityUrn)!,
            publicIdentifier: v.universalName,
            numFollowers: v.followingInfo?.followerCount,
            logo: resolveLinkedVectorImageUrl(v.logo?.image)
          } as AffiliatedCompany
        ]
      )
    ),
    groupsResolutionResults: Object.fromEntries(
      Object.entries(o.groupsResolutionResults ?? {}).map(([k, v]) => [
        k,
        {
          ...omit(v, 'logo', '$recipeType'),
          id: getIdFromUrn(v.entityUrn)!,
          logo: resolveLinkedVectorImageUrl(v.logo)
        } as Group
      ])
    ),
    showcasePagesResolutionResults: Object.fromEntries(
      Object.entries(o.showcasePagesResolutionResults ?? {}).map(([k, v]) => [
        k,
        {
          ...omit(
            v,
            'universalName',
            'logo',
            '$recipeType',
            'followingInfo',
            'showcase',
            'paidCompany'
          ),
          id: getIdFromUrn(v.entityUrn)!,
          publicIdentifier: v.universalName,
          numFollowers: v.followingInfo?.followerCount,
          logo: resolveLinkedVectorImageUrl(v.logo?.image)
        } as ShowcasePage
      ])
    )
  }
}
