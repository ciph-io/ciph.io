(function () {

const videos = {
    dev: {
        freeCredit: '0-2-b0723f064198dcdfc1c6d974cdcaff0c-c515874444c4569089cfb54607ef12f2-c50e622bd6d9f36b1d08a51e253fd6ca-91f4fb2df467c8e7cf01ba57836d1eda07e154af78fe6cc028b5d10a0a6c6453',
        intro: '0-2-453c879bdbc2c0bb288f525e84260688-43170aee820562a4adbad4914d37bf41-b04ec42d9d19ed890ddc2d259c094e8d-25f8ed9b264a6953643d540bd99c492343ec81f2148473d660508d6af075ab4d',
        privacy: '0-2-476861c1d265deb3bc45098fa132ada6-0b0da74344383d00fb616e84df7ef355-904e9e0416b950e74ffdb5a13de72440-2787888ab82f51b77428c5f776c90f7213f38bbd9fcf484c13d2373de583cf5d',
        security: '1-2-d18c870fc35f72a615eb7e66b644eb70-dac53d9a38b6fce4382897d66a212ca7-a6bbbad49e7ae290e0a5ecbeda7a7f7c-f8ba139c0bd383d030b4971c431fe4461b25b050f52e65a83ccaf8fd3e6d1f36',
    },
    prod: {
        freeCredit: '0-2-5450c7c623aaa69500c4773975546bd0-1b0fa303756abe8f008f574f81d5dc99-4a256d57a842f2d1c307e01df80d57ad-2a6eb1da1fc5b9b553e7039cede4d54417f81bc633f578aa941f9d939f16d935',
        windowsInstall: '0-2-41f497c969515a024bb9762a37c3ce08-31e991414995abb135e5edf01d1efa14-187a5763dc1a89b104867e6f6240be4a-57f05b2f39e4af3cdefcad053d6e75fe6b36c39261ba87294fa354cf05c3fac9',
        youtubeBackup: '0-2-2ba3581377de6b1e1d1e7888dc873f40-ca64b8de1973b4b73393b8205e825309-46f52b44cf866e5edf4fab13e6557508-484456be797d325ba0b182314b75c1b1b23812c86f7e34c5215c1a71ed18dd27',
        publishPage: '0-2-887bcfa554883d08e8919f68f1d0fa25-26b901c145d87a9b0cb038f92e62d9fc-ada6254562390855274a263502b7c6ac-772e4883a09a1ec3c4c246009e24516f0b079d51afe092a56a966f90d71cd83e',
        publishCollection: '0-2-62e0b52e51f52c4d6a03a9e0b8f33d97-baca0c4f307629e6af6a6ecc9e773dbe-ba06454d7b133ba0b910f3baa24dfc36-12646a92c2e4f4e8f57148ed7fba849cd3d0f12e6638b8bd8ef092d2349d52c0',
        publishVideo: '0-2-ffc43e21283951988fa5a12a47f9ed18-df3669fa6af3e60fb9c102f7feea08e3-5e55c91277e0affa46b7468b365a65a2-7e7dbcc841ae419b78d57bdd972fc5a6a7e5904d59664290d072a7a465309987',
        intro: '0-2-9e3c8fbfcc15e51626b1cc19247c92be-280d5cd8fed0105cbeca6cac43854b39-3aed9d3f892f1267198266af4331b059-404fda4315314a026c1f67cf833f531fd42da93224e86aa47838bc0851320268',
        chat: '1-2-74e603894295181a66987ea6e30b0697-1fb1225b96e62c9ae1b8ec22598caee4-196613bb7e033c59cd97a951d421bb52-3252fedb07428b3d5afd2397ca534baf224ff23556a6d1a310f692904a67fa8a',
        development: '0-2-d264c333e418ebb4974c3e42df88adee-15a0ae933f6bc1a11a281485bd7679a6-8ef5a7569d4bea1fa4da20150a4db593-f54a6219017bf85a36df7d8f4ff7dc2841b0b488fb56d674d804e3803e49eac7',
        partner: '1-2-270c6685a1d681a5e0488d03de374082-b5a70ca064b5202381a0950ffd366c9c-f184e357adb0ae510f480e7217dedbeb-b36d9feb874601443323baabd1bb75c61b28b0be169dff1ec07d5a77f15fc29e',
        premium: '0-2-ccda8ac56da4ac973f390c52420d2b85-1d08a9d9b11464392d212a7e2e5b2f94-7b757f77d817de5b5a1c4279c88d1bfd-9abd10b0f34425863818790426e11068f5b2bdce927a112b552fdcffcceff65c',
        privacy: '0-2-0cbac3f97725de82f3f45ff8cd0257f8-3915056dbf0996089e57ccbc56d62745-74f22f073c6428dfdb84483ae958e40f-72b7da35883cd44b85f390d794620d1be1a1a08407e6c777243cef80bb6b0665',
        security: '1-2-450b0d0420efb21d7eef96b2270bc27c-78abbb62dbda1f9125e56ba00ea07c4c-0d56448791b694cf3b1a2c49f1a17319-ece3cf4222b499ca0dbd758938783190fdb3f53b178e15e75aeba41336dbe4c0',
    }
}

const env = location.host === 'dev.ciph.io' ? 'dev' : 'prod'

/* exports */
window.CiphEnter = class CiphEnter {

    constructor () {
        // set with player object when playing
        this.active = null
        // if there is no link then show intro video
        if (!location.hash) {
            this.play('freeCredit')
        }
    }

    async play (name) {
        if (this.active) {
            await this.active.videoElm.pause()
            await this.active.shaka.unload()
        }
        assert(videos[env][name], `Unknown video name ${name}`)
        this.active = new CiphVideoPlayer({
            link: videos[env][name],
            resume: false,
        })
    }

}

})()