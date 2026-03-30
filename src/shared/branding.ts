export const BRANDING = {
    shortName: 'W.O.L.K.',
    appName: 'Words On Live Kanvas',
    productName: 'Words On Live Kanvas - Open Culture Tech',
    tagline: 'Animated lyric engine',
    repositoryUrl: 'https://github.com/WesWeCan/oct-wolk',
    releasesUrl: 'https://github.com/WesWeCan/oct-wolk/releases',
    issuesUrl: 'https://github.com/WesWeCan/oct-wolk/issues',
    collaborators: {
        cablaiUrl: 'https://www.cablai.com/',
        rbdjanUrl: 'https://rbdjan.nl/',
        vjBikkelUrl: 'https://bikkelamsterdam.nl/blog/vj/',
        contextUndefinedUrl: 'https://contextundefined.nl',
    },
    initiative: {
        name: 'Open Culture Tech 2.0',
        url: 'https://www.openculturetech.com/',
        partnerName: 'Thunderboom Records',
        partnerUrl: 'https://www.thunderboomrecords.com/',
    },
} as const;

export const buildAppTitle = (context?: string): string => {
    if (!context) {
        return `${BRANDING.shortName} - ${BRANDING.appName}`;
    }

    return `${context} - ${BRANDING.shortName}`;
};
