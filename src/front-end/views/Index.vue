<script setup lang="ts">
import { onMounted } from 'vue';
import CreativeTechnologistLogo from '@/front-end/components/CreativeTechnologistLogo.vue';
import HomeProjectListSection from '@/front-end/components/HomeProjectListSection.vue';
import { BRANDING, buildAppTitle } from '@/shared/branding';

const openExternal = async (url: string): Promise<void> => {
    if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(url);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

const onExternalKeydown = (event: KeyboardEvent, url: string): void => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openExternal(url);
    }
};

onMounted(() => {
    document.title = buildAppTitle();
});
</script>

<template>

<div class="home-page">
    <div class="home-layout">
        <section class="home-brand">
            <div class="home-brand__hero">
                <p class="home-brand__eyebrow">{{ BRANDING.appName }}</p>
                <h1 class="main-title">{{ BRANDING.shortName }}</h1>
                <h2 class="subtitle">{{ BRANDING.tagline }}</h2>
            </div>

            <footer class="footer">
                <div class="credits-section">
                    <span class="label">Concept and Development by:</span>
                    <ul class="developers" role="list">
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit Cablai website" @click="openExternal(BRANDING.collaborators.cablaiUrl)" @keydown="onExternalKeydown($event, BRANDING.collaborators.cablaiUrl)">
                            <img src="../../back-end/logos/cablai.png" alt="Cablai" class="logo-cablai" />
                        </li>
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit RBDJAN website" @click="openExternal(BRANDING.collaborators.rbdjanUrl)" @keydown="onExternalKeydown($event, BRANDING.collaborators.rbdjanUrl)">
                            <span class="rbjan-text">RBJAN</span>
                        </li>
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit VJ Bikkel page" @click="openExternal(BRANDING.collaborators.vjBikkelUrl)" @keydown="onExternalKeydown($event, BRANDING.collaborators.vjBikkelUrl)">
                            <img src="../../back-end/logos/vj_bikkel.png" alt="VJ BIKKEL" class="logo-bikkel" />
                        </li>
                        <li class="dev-item logo-wesley dev-item--clickable" role="link" tabindex="0" aria-label="Visit Context Undefined website" @click="openExternal(BRANDING.collaborators.contextUndefinedUrl)" @keydown="onExternalKeydown($event, BRANDING.collaborators.contextUndefinedUrl)">
                            <CreativeTechnologistLogo />
                        </li>
                    </ul>
                </div>

                <div class="org-section">
                    <span>Part of </span>
                    <a :href="BRANDING.initiative.url" target="_blank" rel="noopener noreferrer" class="oct-link">{{ BRANDING.initiative.name }}</a>
                    <span> by </span>
                    <span class="oct-link oct-link--clickable" role="link" tabindex="0" @click="openExternal(BRANDING.initiative.partnerUrl)" @keydown="onExternalKeydown($event, BRANDING.initiative.partnerUrl)">{{ BRANDING.initiative.partnerName }}</span>
                </div>
            </footer>
        </section>

        <HomeProjectListSection />
    </div>
</div>
</template>