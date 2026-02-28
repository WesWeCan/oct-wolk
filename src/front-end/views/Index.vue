<script setup lang="ts">
import { onMounted } from 'vue';
import CreativeTechnologistLogo from '@/front-end/components/CreativeTechnologistLogo.vue';

onMounted(() => {
    document.title = 'W.O.L.K. - Words On Live Kanvas';
});
</script>

<template>

<div class="splash-screen">
    <div class="content-wrapper">
        <section class="hero">
            <h1 class="main-title">W.O.L.K.</h1>
            <h2 class="subtitle">Words On Live Kanvas</h2>
            <p class="tagline">Transform your lyrics into animated visuals</p>
        </section>

        <nav class="navigation">
            <RouterLink to="/projects" class="nav-btn">Projects</RouterLink>
            <RouterLink to="/song-bank" class="nav-btn">Analyze your lyrics</RouterLink>
            <RouterLink to="/editor" class="nav-btn">Edit your visuals</RouterLink>
        </nav>

        <footer class="footer">
            <div class="credits-section">
                <span class="label">Concept and Development by:</span>
                <div class="developers">
                   
                    <div class="dev-item">
                        <img src="../../back-end/logos/cablai.png" alt="Cablai" class="logo-cablai" />
                    </div>
                    <div class="dev-item">
                        <span class="rbjan-text">RBJAN</span>
                    </div>
                    <div class="dev-item">
                        <img src="../../back-end/logos/vj_bikkel.png" alt="VJ BIKKEL" class="logo-bikkel" />
                    </div>
                    <div class="dev-item logo-wesley">
                        <CreativeTechnologistLogo />
                    </div>
                </div>
            </div>

            <div class="org-section">
                <span>Part of </span>
                <a href="https://www.openculturetech.com/" target="_blank" rel="noopener noreferrer" class="oct-link">Open Culture Tech 2.0</a>
                <span> by Thunderboom Records</span>
            </div>
        </footer>
    </div>
</div>
</template>