<script setup lang="ts">
import { onMounted } from 'vue';
import CreativeTechnologistLogo from '@/front-end/components/CreativeTechnologistLogo.vue';
import HomeProjectListSection from '@/front-end/components/HomeProjectListSection.vue';

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
    document.title = 'W.O.L.K. - Words On Live Kanvas';
});
</script>

<template>

<div class="home-page">
    <div class="home-layout">
        <section class="home-brand">
            <div class="home-brand__hero">
                <p class="home-brand__eyebrow">Words On Live Kanvas</p>
                <h1 class="main-title">W.O.L.K.</h1>
                <h2 class="subtitle">Animated lyric engine</h2>
            </div>

            <footer class="footer">
                <div class="credits-section">
                    <span class="label">Concept and Development by:</span>
                    <ul class="developers" role="list">
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit Cablai website" @click="openExternal('https://www.cablai.com/')" @keydown="onExternalKeydown($event, 'https://www.cablai.com/')">
                            <img src="../../back-end/logos/cablai.png" alt="Cablai" class="logo-cablai" />
                        </li>
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit RBDJAN website" @click="openExternal('https://rbdjan.nl/')" @keydown="onExternalKeydown($event, 'https://rbdjan.nl/')">
                            <span class="rbjan-text">RBJAN</span>
                        </li>
                        <li class="dev-item dev-item--clickable" role="link" tabindex="0" aria-label="Visit VJ Bikkel page" @click="openExternal('https://bikkelamsterdam.nl/blog/vj/')" @keydown="onExternalKeydown($event, 'https://bikkelamsterdam.nl/blog/vj/')">
                            <img src="../../back-end/logos/vj_bikkel.png" alt="VJ BIKKEL" class="logo-bikkel" />
                        </li>
                        <li class="dev-item logo-wesley dev-item--clickable" role="link" tabindex="0" aria-label="Visit Context Undefined website" @click="openExternal('https://contextundefined.nl')" @keydown="onExternalKeydown($event, 'https://contextundefined.nl')">
                            <CreativeTechnologistLogo />
                        </li>
                    </ul>
                </div>

                <div class="org-section">
                    <span>Part of </span>
                    <a href="https://www.openculturetech.com/" target="_blank" rel="noopener noreferrer" class="oct-link">Open Culture Tech 2.0</a>
                    <span> by </span>
                    <span class="oct-link oct-link--clickable" role="link" tabindex="0" @click="openExternal('https://www.thunderboomrecords.com/')" @keydown="onExternalKeydown($event, 'https://www.thunderboomrecords.com/')">Thunderboom Records</span>
                </div>
            </footer>
        </section>

        <HomeProjectListSection />
    </div>
</div>
</template>