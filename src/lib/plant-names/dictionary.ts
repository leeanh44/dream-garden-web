/**
 * Từ điển tên cây cảnh lá phổ biến ở Việt Nam → danh pháp khoa học.
 *
 * - `vi`: tên gọi hiển thị / điền vào ô "Tên cây".
 * - `aliases`: tên gọi khác, tên lóng trong giới chơi cây (tìm không dấu).
 * - `scientific`: chi + loài (không kèm cultivar). Chỉ có chi khi là giống lai không rõ loài.
 * - `cultivar`: tên dòng, không kèm dấu nháy.
 *
 * Tên Việt thường mơ hồ (một tên ứng với nhiều loài) → ô gợi ý luôn hiện nhiều lựa chọn để người dùng tự chọn.
 */
export type PlantNameEntry = {
  vi: string
  aliases?: string[]
  scientific: string
  cultivar?: string
}

export const PLANT_NAMES: PlantNameEntry[] = [
  // --- Monstera ---------------------------------------------------------------
  { vi: 'Monstera lá xẻ', aliases: ['lưng rùa', 'trầu bà lá xẻ', 'monstera', 'mon'], scientific: 'Monstera deliciosa' },
  { vi: 'Monstera Thai Constellation', aliases: ['monstera thái', 'mon thái', 'thai con', 'thai'], scientific: 'Monstera deliciosa', cultivar: 'Thai Constellation' },
  { vi: 'Monstera Albo', aliases: ['mon albo', 'monstera cẩm thạch', 'albo'], scientific: 'Monstera deliciosa', cultivar: 'Albo Variegata' },
  { vi: 'Monstera Aurea', aliases: ['monstera vàng', 'mon aurea'], scientific: 'Monstera deliciosa', cultivar: 'Aurea' },
  { vi: 'Monstera Mint', aliases: ['mon mint', 'monstera xanh bạc hà'], scientific: 'Monstera deliciosa', cultivar: 'Mint' },
  { vi: 'Monstera lá lỗ', aliases: ['monstera adansonii', 'mon lỗ', 'monstera monkey mask'], scientific: 'Monstera adansonii' },
  { vi: 'Monstera adansonii Albo', aliases: ['adansonii albo', 'mon lỗ albo'], scientific: 'Monstera adansonii', cultivar: 'Albo Variegata' },
  { vi: 'Monstera standleyana Albo', aliases: ['standleyana', 'monstera sọc trắng'], scientific: 'Monstera standleyana', cultivar: 'Albo Variegata' },
  { vi: 'Monstera Peru', aliases: ['mon peru', 'karstenianum'], scientific: 'Monstera karstenianum' },
  { vi: 'Monstera dubia', aliases: ['mon dubia', 'monstera leo cây'], scientific: 'Monstera dubia' },
  { vi: 'Monstera siltepecana', aliases: ['mon bạc', 'siltepecana'], scientific: 'Monstera siltepecana' },
  { vi: 'Monstera obliqua', aliases: ['obliqua'], scientific: 'Monstera obliqua' },
  { vi: 'Monstera mini', aliases: ['trầu bà lá xẻ mini', 'mini monstera', 'tetrasperma'], scientific: 'Rhaphidophora tetrasperma' },

  // --- Philodendron -----------------------------------------------------------
  { vi: 'Philodendron Pink Princess', aliases: ['ppp', 'trầu bà hồng', 'philo hồng', 'trầu bà công chúa hồng', 'pink princess'], scientific: 'Philodendron erubescens', cultivar: 'Pink Princess' },
  { vi: 'Philodendron White Princess', aliases: ['trầu bà công chúa trắng', 'white princess'], scientific: 'Philodendron erubescens', cultivar: 'White Princess' },
  { vi: 'Philodendron White Knight', aliases: ['hiệp sĩ trắng', 'white knight'], scientific: 'Philodendron erubescens', cultivar: 'White Knight' },
  { vi: 'Philodendron White Wizard', aliases: ['phù thuỷ trắng', 'white wizard'], scientific: 'Philodendron erubescens', cultivar: 'White Wizard' },
  { vi: 'Philodendron Strawberry Shake', aliases: ['strawberry shake', 'trầu bà dâu'], scientific: 'Philodendron erubescens', cultivar: 'Strawberry Shake' },
  { vi: 'Philodendron Red Anderson', aliases: ['red anderson'], scientific: 'Philodendron erubescens', cultivar: 'Red Anderson' },
  { vi: 'Philodendron Paraiso Verde', aliases: ['paraiso verde'], scientific: 'Philodendron', cultivar: 'Paraiso Verde' },
  { vi: 'Philodendron Ring of Fire', aliases: ['ring of fire', 'vòng lửa'], scientific: 'Philodendron', cultivar: 'Ring of Fire' },
  { vi: 'Philodendron Florida Beauty', aliases: ['florida beauty'], scientific: 'Philodendron', cultivar: 'Florida Beauty' },
  { vi: 'Philodendron Caramel Marble', aliases: ['caramel marble'], scientific: 'Philodendron', cultivar: 'Caramel Marble' },
  { vi: 'Philodendron Burle Marx', aliases: ['burle marx'], scientific: 'Philodendron', cultivar: 'Burle Marx' },
  { vi: 'Philodendron Painted Lady', aliases: ['painted lady'], scientific: 'Philodendron', cultivar: 'Painted Lady' },
  { vi: 'Philodendron Birkin', aliases: ['trầu bà birkin', 'birkin', 'trầu bà sọc trắng'], scientific: 'Philodendron', cultivar: 'Birkin' },
  { vi: 'Trầu bà đế vương đỏ', aliases: ['đế vương đỏ', 'imperial red'], scientific: 'Philodendron', cultivar: 'Imperial Red' },
  { vi: 'Trầu bà đế vương xanh', aliases: ['đế vương xanh', 'imperial green'], scientific: 'Philodendron', cultivar: 'Imperial Green' },
  { vi: 'Trầu bà đế vương vàng', aliases: ['đế vương vàng', 'moonlight', 'đế vương chanh'], scientific: 'Philodendron', cultivar: 'Moonlight' },
  { vi: 'Philodendron Prince of Orange', aliases: ['đế vương cam', 'prince of orange'], scientific: 'Philodendron', cultivar: 'Prince of Orange' },
  { vi: 'Philodendron McColley’s Finale', aliases: ['mccolley', 'mccolleys finale'], scientific: 'Philodendron', cultivar: 'McColley’s Finale' },
  { vi: 'Philodendron Black Cardinal', aliases: ['black cardinal', 'đế vương đen'], scientific: 'Philodendron', cultivar: 'Black Cardinal' },
  { vi: 'Philodendron Rojo Congo', aliases: ['rojo congo', 'trầu bà đỏ'], scientific: 'Philodendron', cultivar: 'Rojo Congo' },
  { vi: 'Trầu bà lá tim', aliases: ['philodendron lá tim', 'heartleaf', 'trầu bà tim'], scientific: 'Philodendron hederaceum' },
  { vi: 'Philodendron Brasil', aliases: ['trầu bà brasil', 'trầu bà brazil', 'brasil'], scientific: 'Philodendron hederaceum', cultivar: 'Brasil' },
  { vi: 'Philodendron Micans', aliases: ['trầu bà nhung', 'micans'], scientific: 'Philodendron hederaceum', cultivar: 'Micans' },
  { vi: 'Philodendron Lemon Lime', aliases: ['trầu bà chanh', 'lemon lime'], scientific: 'Philodendron hederaceum', cultivar: 'Lemon Lime' },
  { vi: 'Philodendron gloriosum', aliases: ['gloriosum', 'trầu bà nhung vân trắng'], scientific: 'Philodendron gloriosum' },
  { vi: 'Philodendron melanochrysum', aliases: ['melanochrysum', 'trầu bà nhung đen'], scientific: 'Philodendron melanochrysum' },
  { vi: 'Philodendron verrucosum', aliases: ['verrucosum'], scientific: 'Philodendron verrucosum' },
  { vi: 'Philodendron billietiae', aliases: ['billietiae', 'billie'], scientific: 'Philodendron billietiae' },
  { vi: 'Philodendron squamiferum', aliases: ['squamiferum', 'trầu bà lông đỏ'], scientific: 'Philodendron squamiferum' },
  { vi: 'Philodendron pedatum', aliases: ['pedatum'], scientific: 'Philodendron pedatum' },
  { vi: 'Philodendron violin', aliases: ['bipennifolium', 'trầu bà đàn violin'], scientific: 'Philodendron bipennifolium' },
  { vi: 'Philodendron Jose Buono', aliases: ['jose buono'], scientific: 'Philodendron', cultivar: 'Jose Buono' },
  { vi: 'Philodendron domesticum Variegata', aliases: ['domesticum', 'trầu bà tai voi cẩm thạch'], scientific: 'Philodendron domesticum', cultivar: 'Variegata' },
  { vi: 'Trầu bà Thanh Xuân', aliases: ['thanh xuân', 'philodendron selloum', 'trầu bà lá xẻ thanh xuân', 'selloum'], scientific: 'Thaumatophyllum bipinnatifidum' },
  { vi: 'Philodendron Xanadu', aliases: ['xanadu', 'thanh xuân mini'], scientific: 'Thaumatophyllum xanadu' },

  // --- Trầu bà (Epipremnum / Scindapsus) --------------------------------------
  { vi: 'Trầu bà vàng', aliases: ['trầu bà', 'trầu bà xanh', 'pothos', 'golden pothos'], scientific: 'Epipremnum aureum' },
  { vi: 'Trầu bà cẩm thạch', aliases: ['marble queen', 'trầu bà marble'], scientific: 'Epipremnum aureum', cultivar: 'Marble Queen' },
  { vi: 'Trầu bà Njoy', aliases: ['njoy', 'n joy'], scientific: 'Epipremnum aureum', cultivar: 'N’Joy' },
  { vi: 'Trầu bà Manjula', aliases: ['manjula'], scientific: 'Epipremnum aureum', cultivar: 'Manjula' },
  { vi: 'Trầu bà Neon', aliases: ['trầu bà chanh', 'neon'], scientific: 'Epipremnum aureum', cultivar: 'Neon' },
  { vi: 'Trầu bà Global Green', aliases: ['global green'], scientific: 'Epipremnum aureum', cultivar: 'Global Green' },
  { vi: 'Trầu bà Pearls and Jade', aliases: ['pearls and jade', 'ngọc trai'], scientific: 'Epipremnum aureum', cultivar: 'Pearls and Jade' },
  { vi: 'Trầu bà Cebu Blue', aliases: ['cebu blue', 'trầu bà xanh bạc'], scientific: 'Epipremnum pinnatum', cultivar: 'Cebu Blue' },
  { vi: 'Epipremnum pinnatum Albo', aliases: ['pinnatum albo'], scientific: 'Epipremnum pinnatum', cultivar: 'Albo Variegata' },
  { vi: 'Trầu bà bạc', aliases: ['trầu bà nhung bạc', 'satin pothos', 'scindapsus'], scientific: 'Scindapsus pictus', cultivar: 'Argyraeus' },
  { vi: 'Scindapsus Exotica', aliases: ['exotica'], scientific: 'Scindapsus pictus', cultivar: 'Exotica' },
  { vi: 'Scindapsus Moonlight', aliases: ['treubii moonlight'], scientific: 'Scindapsus treubii', cultivar: 'Moonlight' },

  // --- Anthurium --------------------------------------------------------------
  { vi: 'Hồng môn', aliases: ['vĩ hoa tôn', 'môn hồng', 'anthurium'], scientific: 'Anthurium andraeanum' },
  { vi: 'Hồng môn hạc', aliases: ['flamingo', 'scherzerianum'], scientific: 'Anthurium scherzerianum' },
  { vi: 'Anthurium clarinervium', aliases: ['clarinervium', 'hồng môn nhung tim'], scientific: 'Anthurium clarinervium' },
  { vi: 'Anthurium crystallinum', aliases: ['crystallinum', 'hồng môn pha lê'], scientific: 'Anthurium crystallinum' },
  { vi: 'Anthurium warocqueanum', aliases: ['queen anthurium', 'nữ hoàng', 'warocqueanum'], scientific: 'Anthurium warocqueanum' },
  { vi: 'Anthurium veitchii', aliases: ['king anthurium', 'vua hồng môn', 'veitchii'], scientific: 'Anthurium veitchii' },
  { vi: 'Anthurium magnificum', aliases: ['magnificum'], scientific: 'Anthurium magnificum' },
  { vi: 'Anthurium regale', aliases: ['regale'], scientific: 'Anthurium regale' },
  { vi: 'Anthurium forgetii', aliases: ['forgetii'], scientific: 'Anthurium forgetii' },
  { vi: 'Anthurium luxurians', aliases: ['luxurians'], scientific: 'Anthurium luxurians' },
  { vi: 'Anthurium vittarifolium', aliases: ['vittarifolium', 'hồng môn lá dải'], scientific: 'Anthurium vittarifolium' },
  { vi: 'Anthurium Ace of Spades', aliases: ['ace of spades', 'át bích'], scientific: 'Anthurium', cultivar: 'Ace of Spades' },
  { vi: 'Anthurium Silver Blush', aliases: ['silver blush'], scientific: 'Anthurium', cultivar: 'Silver Blush' },

  // --- Alocasia / Colocasia / Xanthosoma / Caladium ---------------------------
  { vi: 'Ráy', aliases: ['cây ráy', 'môn khổng lồ', 'alocasia', 'tai voi'], scientific: 'Alocasia macrorrhizos' },
  { vi: 'Ráy cẩm thạch', aliases: ['alocasia variegata', 'ráy var', 'macrorrhizos variegata'], scientific: 'Alocasia macrorrhizos', cultivar: 'Variegata' },
  { vi: 'Alocasia Polly', aliases: ['môn polly', 'môn châu phi', 'amazonica'], scientific: 'Alocasia × amazonica', cultivar: 'Polly' },
  { vi: 'Alocasia Frydek', aliases: ['frydek', 'môn nhung xanh'], scientific: 'Alocasia micholitziana', cultivar: 'Frydek' },
  { vi: 'Alocasia Frydek Variegata', aliases: ['frydek var', 'frydek variegata'], scientific: 'Alocasia micholitziana', cultivar: 'Frydek Variegated' },
  { vi: 'Alocasia zebrina', aliases: ['môn ngựa vằn', 'zebrina'], scientific: 'Alocasia zebrina' },
  { vi: 'Alocasia Black Velvet', aliases: ['black velvet', 'môn nhung đen'], scientific: 'Alocasia reginula', cultivar: 'Black Velvet' },
  { vi: 'Alocasia Red Secret', aliases: ['red secret', 'cuprea'], scientific: 'Alocasia cuprea', cultivar: 'Red Secret' },
  { vi: 'Alocasia Dragon Scale', aliases: ['dragon scale', 'vảy rồng'], scientific: 'Alocasia baginda', cultivar: 'Dragon Scale' },
  { vi: 'Alocasia Silver Dragon', aliases: ['silver dragon', 'rồng bạc'], scientific: 'Alocasia baginda', cultivar: 'Silver Dragon' },
  { vi: 'Alocasia Stingray', aliases: ['stingray', 'cá đuối'], scientific: 'Alocasia macrorrhizos', cultivar: 'Stingray' },
  { vi: 'Alocasia Okinawa Silver', aliases: ['okinawa silver', 'odora variegata'], scientific: 'Alocasia odora', cultivar: 'Okinawa Silver' },
  { vi: 'Alocasia Pink Dragon', aliases: ['pink dragon', 'rồng hồng'], scientific: 'Alocasia', cultivar: 'Pink Dragon' },
  { vi: 'Alocasia longiloba', aliases: ['longiloba'], scientific: 'Alocasia longiloba' },
  { vi: 'Khoai môn', aliases: ['môn', 'colocasia'], scientific: 'Colocasia esculenta' },
  { vi: 'Môn đen', aliases: ['black magic', 'khoai môn đen'], scientific: 'Colocasia esculenta', cultivar: 'Black Magic' },
  { vi: 'Môn bạc hà', aliases: ['dọc mùng', 'bạc hà'], scientific: 'Colocasia gigantea' },
  { vi: 'Môn chuột Mickey', aliases: ['mickey mouse', 'xanthosoma'], scientific: 'Xanthosoma robustum', cultivar: 'Mickey Mouse' },
  { vi: 'Xanthosoma Albo Marginata', aliases: ['albo marginata', 'môn viền trắng'], scientific: 'Xanthosoma sagittifolium', cultivar: 'Albo Marginata' },
  { vi: 'Môn kiểng', aliases: ['môn lá màu', 'caladium', 'môn thái'], scientific: 'Caladium bicolor' },

  // --- Syngonium --------------------------------------------------------------
  { vi: 'Tróc bạc', aliases: ['syngonium', 'trầu bà chân vịt', 'tróc bạc xanh'], scientific: 'Syngonium podophyllum' },
  { vi: 'Syngonium Albo', aliases: ['tróc bạc albo', 'syngonium cẩm thạch'], scientific: 'Syngonium podophyllum', cultivar: 'Albo Variegatum' },
  { vi: 'Syngonium Aurea', aliases: ['tróc bạc vàng', 'syngonium vàng'], scientific: 'Syngonium podophyllum', cultivar: 'Aurea' },
  { vi: 'Syngonium Neon Robusta', aliases: ['tróc bạc hồng', 'neon robusta'], scientific: 'Syngonium podophyllum', cultivar: 'Neon Robusta' },
  { vi: 'Syngonium Three Kings', aliases: ['three kings', 'tam vương'], scientific: 'Syngonium podophyllum', cultivar: 'Three Kings' },
  { vi: 'Syngonium Mojito', aliases: ['mojito'], scientific: 'Syngonium podophyllum', cultivar: 'Mojito' },
  { vi: 'Syngonium Pink Spot', aliases: ['pink spot', 'tróc bạc chấm hồng'], scientific: 'Syngonium podophyllum', cultivar: 'Pink Spot' },
  { vi: 'Syngonium Milk Confetti', aliases: ['milk confetti'], scientific: 'Syngonium podophyllum', cultivar: 'Milk Confetti' },
  { vi: 'Syngonium Strawberry Ice', aliases: ['strawberry ice'], scientific: 'Syngonium podophyllum', cultivar: 'Strawberry Ice' },
  { vi: 'Syngonium Red Spot Tricolor', aliases: ['red spot tricolor', 'tricolor'], scientific: 'Syngonium podophyllum', cultivar: 'Red Spot Tricolor' },
  { vi: 'Syngonium wendlandii', aliases: ['wendlandii', 'tróc bạc nhung'], scientific: 'Syngonium wendlandii' },

  // --- Aglaonema / Dieffenbachia / Homalomena ---------------------------------
  { vi: 'Vạn lộc', aliases: ['phú quý', 'aglaonema đỏ', 'aglaonema'], scientific: 'Aglaonema' },
  { vi: 'Bạch mã hoàng tử', aliases: ['bạch mã', 'pseudobracteatum'], scientific: 'Aglaonema', cultivar: 'Pseudobracteatum' },
  { vi: 'Vạn niên thanh', aliases: ['chinese evergreen'], scientific: 'Aglaonema modestum' },
  { vi: 'Vạn niên thanh đốm', aliases: ['môn trường sinh', 'dieffenbachia', 'môn đốm'], scientific: 'Dieffenbachia seguine' },
  { vi: 'Thiên niên kiện', aliases: ['homalomena'], scientific: 'Homalomena occulta' },
  { vi: 'Lan ý', aliases: ['bạch môn', 'peace lily', 'spathiphyllum'], scientific: 'Spathiphyllum wallisii' },
  { vi: 'Lan ý Domino', aliases: ['lan ý cẩm thạch', 'domino'], scientific: 'Spathiphyllum wallisii', cultivar: 'Domino' },

  // --- Cây nội thất phổ biến --------------------------------------------------
  { vi: 'Kim tiền', aliases: ['zz', 'zamioculcas', 'kim phát tài'], scientific: 'Zamioculcas zamiifolia' },
  { vi: 'Kim tiền đen', aliases: ['zz raven', 'raven'], scientific: 'Zamioculcas zamiifolia', cultivar: 'Raven' },
  { vi: 'Kim tiền cẩm thạch', aliases: ['zz variegata', 'kim tiền var'], scientific: 'Zamioculcas zamiifolia', cultivar: 'Variegata' },
  { vi: 'Lưỡi hổ', aliases: ['hổ vĩ', 'sansevieria', 'lưỡi cọp'], scientific: 'Dracaena trifasciata' },
  { vi: 'Lưỡi hổ viền vàng', aliases: ['laurentii', 'hổ vĩ viền vàng'], scientific: 'Dracaena trifasciata', cultivar: 'Laurentii' },
  { vi: 'Lưỡi hổ trụ', aliases: ['lưỡi hổ ống', 'cylindrica'], scientific: 'Dracaena angolensis' },
  { vi: 'Thiết mộc lan', aliases: ['phát tài', 'phát tài khúc'], scientific: 'Dracaena fragrans' },
  { vi: 'Phát lộc', aliases: ['trúc phát tài', 'trúc phát lộc', 'lucky bamboo'], scientific: 'Dracaena sanderiana' },
  { vi: 'Phất dụ', aliases: ['huyết dụ', 'cordyline'], scientific: 'Cordyline fruticosa' },
  { vi: 'Cô tòng', aliases: ['croton', 'cô tòng lá màu'], scientific: 'Codiaeum variegatum' },
  { vi: 'Cao su', aliases: ['đa búp đỏ', 'đa cao su', 'ficus elastica'], scientific: 'Ficus elastica' },
  { vi: 'Cao su cẩm thạch', aliases: ['tineke', 'đa búp cẩm thạch'], scientific: 'Ficus elastica', cultivar: 'Tineke' },
  { vi: 'Cao su Ruby', aliases: ['ruby', 'đa búp hồng'], scientific: 'Ficus elastica', cultivar: 'Ruby' },
  { vi: 'Bàng Singapore', aliases: ['bàng sing', 'fiddle leaf fig', 'ficus lyrata'], scientific: 'Ficus lyrata' },
  { vi: 'Kim ngân', aliases: ['pachira', 'money tree'], scientific: 'Pachira aquatica' },
  { vi: 'Ngũ gia bì', aliases: ['schefflera', 'chân chim'], scientific: 'Schefflera arboricola' },
  { vi: 'Cau tiểu trâm', aliases: ['cau tiểu', 'chamaedorea'], scientific: 'Chamaedorea elegans' },
  { vi: 'Cau vàng', aliases: ['cau cảnh', 'areca'], scientific: 'Dypsis lutescens' },
  { vi: 'Cỏ lan chi', aliases: ['dây nhện', 'lan chi', 'spider plant'], scientific: 'Chlorophytum comosum' },
  { vi: 'Thài lài tím', aliases: ['thài lài tía', 'tradescantia'], scientific: 'Tradescantia pallida', cultivar: 'Purpurea' },
  { vi: 'Thài lài vằn', aliases: ['cỏ đậu vằn', 'zebrina'], scientific: 'Tradescantia zebrina' },

  // --- Đuôi công / Maranta ----------------------------------------------------
  { vi: 'Đuôi công', aliases: ['calathea', 'đuôi công lông công', 'makoyana'], scientific: 'Goeppertia makoyana' },
  { vi: 'Calathea orbifolia', aliases: ['orbifolia', 'đuôi công lá tròn'], scientific: 'Goeppertia orbifolia' },
  { vi: 'Calathea White Fusion', aliases: ['white fusion', 'đuôi công cẩm thạch'], scientific: 'Goeppertia', cultivar: 'White Fusion' },
  { vi: 'Đuôi công sọc', aliases: ['rattlesnake', 'lancifolia'], scientific: 'Goeppertia insignis' },
  { vi: 'Calathea roseopicta', aliases: ['roseopicta', 'đuôi công hồng'], scientific: 'Goeppertia roseopicta' },
  { vi: 'Cầu nguyện', aliases: ['maranta', 'cây cầu nguyện'], scientific: 'Maranta leuconeura' },
  { vi: 'Đuôi công Triostar', aliases: ['triostar', 'đuôi công tím', 'stromanthe'], scientific: 'Stromanthe thalia', cultivar: 'Triostar' },

  // --- Khác -------------------------------------------------------------------
  { vi: 'Trường sinh lá tròn', aliases: ['peperomia', 'trường sinh'], scientific: 'Peperomia obtusifolia' },
  { vi: 'Peperomia dưa hấu', aliases: ['dưa hấu', 'watermelon peperomia'], scientific: 'Peperomia argyreia' },
  { vi: 'Cẩm cù', aliases: ['hoya', 'lan sao'], scientific: 'Hoya carnosa' },
  { vi: 'Cẩm cù Krimson Queen', aliases: ['krimson queen', 'hoya cẩm thạch'], scientific: 'Hoya carnosa', cultivar: 'Krimson Queen' },
  { vi: 'Hoya lá tim', aliases: ['hoya tim', 'kerrii', 'sweetheart'], scientific: 'Hoya kerrii' },
  { vi: 'Thu hải đường chấm bi', aliases: ['begonia chấm bi', 'maculata'], scientific: 'Begonia maculata' },
  { vi: 'Thu hải đường lá', aliases: ['begonia rex', 'begonia'], scientific: 'Begonia rex' },
  { vi: 'Cẩm nhung', aliases: ['fittonia', 'lá may mắn'], scientific: 'Fittonia albivenis' },
  { vi: 'Pilea lá tròn', aliases: ['pilea', 'kim tiền trung quốc', 'cây ufo'], scientific: 'Pilea peperomioides' },
  { vi: 'Dương xỉ', aliases: ['boston fern', 'dương xỉ boston'], scientific: 'Nephrolepis exaltata' },
  { vi: 'Dương xỉ sừng hươu', aliases: ['sừng hươu', 'platycerium'], scientific: 'Platycerium bifurcatum' },
]
